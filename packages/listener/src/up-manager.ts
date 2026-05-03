import { ethers } from "ethers";
import { Job } from "./queue";
import { encodeReputation } from "./reputation";
import { registerENSSubdomain, updateENSReputation } from "./ens-registrar";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ERC725 } = require("@erc725/erc725.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LSP6Schema = require("@erc725/erc725.js/schemas/LSP6KeyManager.json");

const REGISTRY_ABI = [
  "function agentToUP(address agent) external view returns (address)",
  "function registerUP(address agent, address upAddress, address kmAddress) external",
  "function updateReputation(address agent, uint96 accuracy, uint96 verifications) external",
];

const UP_ABI = [
  "constructor(address initialOwner)",
  "function setDataBatch(bytes32[] memory dataKeys, bytes[] memory dataValues) external payable",
  "function owner() external view returns (address)",
  "function pendingOwner() external view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function acceptOwnership() external",
];

// LSP6KeyManager v0.15: execute-only, no ownership functions on the KM itself
const KM_ABI = [
  "constructor(address target_)",
  "function execute(bytes calldata payload) external payable returns (bytes memory)",
];

// LSP6 ALL_PERMISSIONS for agent (full control over their UP)
const ALL_PERMISSIONS = ERC725.encodePermissions({
  CHANGEOWNER: true,
  ADDCONTROLLER: true,
  EDITPERMISSIONS: true,
  ADDEXTENSIONS: true,
  CHANGEEXTENSIONS: true,
  ADDUNIVERSALRECEIVERDELEGATE: true,
  CHANGEUNIVERSALRECEIVERDELEGATE: true,
  SUPER_TRANSFERVALUE: true,
  TRANSFERVALUE: true,
  SUPER_CALL: true,
  CALL: true,
  SUPER_STATICCALL: true,
  STATICCALL: true,
  DEPLOY: true,
  SUPER_SETDATA: true,
  SETDATA: true,
  SIGN: true,
  EXECUTE_RELAY_CALL: true,
});

let _upBytecode: string | null = null;
let _kmBytecode: string | null = null;

function getArtifactBytecode(artifactName: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const artifact = require(
      `../../../packages/contracts/node_modules/@lukso/lsp-smart-contracts/artifacts/${artifactName}.json`
    );
    return artifact.bytecode as string;
  } catch {
    throw new Error(
      `${artifactName} artifact not found. Ensure @lukso/lsp-smart-contracts is installed in packages/contracts.`
    );
  }
}

function getUPBytecode(): string {
  if (!_upBytecode) _upBytecode = getArtifactBytecode("UniversalProfile");
  return _upBytecode;
}

function getKMBytecode(): string {
  if (!_kmBytecode) _kmBytecode = getArtifactBytecode("LSP6KeyManager");
  return _kmBytecode;
}

export class UPManager {
  private registry: ethers.Contract;
  private signer: ethers.Signer;

  constructor(
    private readonly registryAddress: string,
    signer: ethers.Signer
  ) {
    this.signer = signer;
    this.registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
  }

  /**
   * Create a Universal Profile + LSP6 KeyManager for an agent and register both
   * in ComposiaRegistry.
   *
   * The LSP6KeyManager in @lukso/lsp-smart-contracts@0.15.0 has no ownership concept
   * (no owner/transferOwnership/acceptOwnership on KM). Ownership is managed at the
   * UP level via LSP14Ownable2Step.
   *
   * Ownership after this call:
   *   UP.owner        = KM (KM acts as the UP's controller layer)
   *   UP.pendingOwner = agent (ready to claim by calling UP.acceptOwnership())
   *   LSP6 perms      = signer: ALL | agent: ALL
   *   (signer keeps ALL so it can continue to call KM.execute(setDataBatch) for updates)
   */
  async createAndRegister(job: Job): Promise<string> {
    const signerAddress = await this.signer.getAddress();

    // ── 1. Deploy UniversalProfile ────────────────────────────────────────────
    const upFactory = new ethers.ContractFactory(UP_ABI, getUPBytecode(), this.signer);
    const up = await upFactory.deploy(signerAddress);
    await up.waitForDeployment();
    const upAddress = await up.getAddress();
    console.log(`[up-manager] Deployed UP for ${job.agent}: ${upAddress}`);

    const upContract = new ethers.Contract(upAddress, UP_ABI, this.signer);

    // ── 2. Write reputation + LSP6 permissions directly while signer owns UP ──
    const joinedAt = Math.floor(Date.now() / 1000);
    const { keys: repKeys, values: repValues } = encodeReputation(job, joinedAt);

    const lsp6Data = ERC725.encodeData(
      [
        { keyName: "AddressPermissions[]", value: [signerAddress, job.agent] },
        { keyName: "AddressPermissions:Permissions:<address>", dynamicKeyParts: signerAddress, value: ALL_PERMISSIONS },
        { keyName: "AddressPermissions:Permissions:<address>", dynamicKeyParts: job.agent,      value: ALL_PERMISSIONS },
      ],
      LSP6Schema
    );

    const allKeys   = [...repKeys,   ...lsp6Data.keys];
    const allValues = [...repValues, ...lsp6Data.values].map(
      (v: unknown) => v instanceof Uint8Array ? ethers.hexlify(v) : String(v)
    );

    const setDataTx = await upContract.setDataBatch(allKeys, allValues);
    await setDataTx.wait();
    console.log(`[up-manager] LSP3 metadata + LSP6 permissions written`);

    // ── 3. Deploy LSP6KeyManager pointing to UP ───────────────────────────────
    const kmFactory = new ethers.ContractFactory(KM_ABI, getKMBytecode(), this.signer);
    const km = await kmFactory.deploy(upAddress);
    await km.waitForDeployment();
    const kmAddress = await km.getAddress();
    console.log(`[up-manager] Deployed KM: ${kmAddress}`);

    const kmContract = new ethers.Contract(kmAddress, KM_ABI, this.signer);
    const upIface = new ethers.Interface([
      "function acceptOwnership() external",
      "function transferOwnership(address newOwner) external",
    ]);

    // ── 4. Transfer UP ownership to KM (2-step LSP14) ─────────────────────────
    // 4a: signer (UP owner) calls transferOwnership directly
    const tx4a = await upContract.transferOwnership(kmAddress);
    await tx4a.wait();

    // 4b: signer (ALL perms in LSP6) routes acceptOwnership() through KM
    //     KM becomes msg.sender for UP → UP sees pendingOwner (KM) accepting → ✓
    const tx4b = await kmContract.execute(upIface.encodeFunctionData("acceptOwnership"));
    await tx4b.wait();
    console.log(`[up-manager] UP.owner = KM`);

    // ── 5. Pre-initiate agent claim (Composia initiates, agent just accepts) ──
    // Signer routes UP.transferOwnership(agent) through KM (signer has ALL/CHANGEOWNER).
    // After this, agent can claim by calling UP.acceptOwnership() directly.
    const tx5 = await kmContract.execute(
      upIface.encodeFunctionData("transferOwnership", [job.agent])
    );
    await tx5.wait();
    console.log(`[up-manager] UP.pendingOwner = ${job.agent} (ready to claim via UP.acceptOwnership())`);

    // ── 6. Register in ComposiaRegistry ───────────────────────────────────────
    const registerTx = await this.registry.registerUP(job.agent, upAddress, kmAddress);
    await registerTx.wait();

    // Seed the reputation snapshot in the registry
    const repTx = await this.registry.updateReputation(job.agent, job.accuracy, job.verifications);
    await repTx.wait();
    console.log(`[up-manager] Registered ${job.agent} → UP:${upAddress} KM:${kmAddress}`);

    // ── 7. Register ENS subdomain on Sepolia (non-blocking — failure is safe) ──
    registerENSSubdomain({
      agentEoa:      job.agent,
      peerId:        job.peerId ?? "",
      accuracy:      job.accuracy,
      verifications: job.verifications,
      upAddress,
      followers:     0,
    }).catch((e) => console.error("[up-manager] ENS registration error:", e));

    return upAddress;
  }

  /**
   * Update LSP3 reputation data by routing setDataBatch through the KM.
   * Signer has ALL_PERMISSIONS on the UP so this works even after the agent
   * has claimed UP ownership.
   */
  async update(job: Job, upAddress: string): Promise<void> {
    const { keys, values } = encodeReputation(job);

    const upIface = new ethers.Interface([
      "function setDataBatch(bytes32[] memory dataKeys, bytes[] memory dataValues) external payable",
    ]);
    const setDataCalldata = upIface.encodeFunctionData("setDataBatch", [keys, values]);

    // Look up KM address from registry
    const registryExt = new ethers.Contract(
      this.registryAddress,
      [...REGISTRY_ABI, "function agentToKM(address) external view returns (address)"],
      this.signer
    );
    const kmAddress: string = await registryExt.agentToKM(job.agent);

    if (kmAddress && kmAddress !== ethers.ZeroAddress) {
      const km = new ethers.Contract(kmAddress, KM_ABI, this.signer);
      const tx = await km.execute(setDataCalldata);
      await tx.wait();
    } else {
      // Fallback: write directly if no KM registered
      const up = new ethers.Contract(upAddress, UP_ABI, this.signer);
      const tx = await up.setDataBatch(keys, values);
      await tx.wait();
    }

    console.log(`[up-manager] Updated reputation for ${job.agent} (accuracy=${job.accuracy}%)`);

    const updateTx = await this.registry.updateReputation(job.agent, job.accuracy, job.verifications);
    await updateTx.wait();

    // Sync Sepolia ReputationState + Namespace text records (non-blocking)
    updateENSReputation(job.agent, job.accuracy, job.verifications, 0)
      .catch((e) => console.error("[up-manager] ENS reputation update error:", e));
  }

  async getUP(agent: string): Promise<string> {
    return this.registry.agentToUP(agent);
  }
}
