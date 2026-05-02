import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { keeperLog } from "@/lib/keeper-log";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const UniversalProfileArtifact = require("@lukso/lsp-smart-contracts/artifacts/UniversalProfile.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LSP6KeyManagerArtifact   = require("@lukso/lsp-smart-contracts/artifacts/LSP6KeyManager.json");

// ── LSP3 / LSP6 constants (copied from /api/keeper/route.ts) ─────────────────
function lsp3Key(name: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}
const LSP3_KEYS = {
  supported:     "0xeafec4d89fa9619884b60000abe425d64acd861a49b8ddf5c0b6962110481f38",
  supported_val: "0xabe425d6",
  reputation:    lsp3Key("gensyn:reputation"),
  verifications: lsp3Key("gensyn:verifications"),
  correct:       lsp3Key("gensyn:correct"),
  joined:        lsp3Key("gensyn:joined"),
  lastActivity:  lsp3Key("gensyn:last_activity"),
};
const LSP6 = {
  ARRAY_KEY:    "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3",
  ARRAY_PREFIX: "0xdf30dba06db6a30e65354d9a64c60986",
  PERMS_PREFIX: "0x4b80742de2bf82acb3630000",
  ALL_PERMS:    "0x0000000000000000000000000000000000000000000000000000000000673f7f",
  SETDATA_PERMS:"0x0000000000000000000000000000000000000000000000000000000000060000",
};
function lsp6PermKey(address: string) { return LSP6.PERMS_PREFIX + address.slice(2).toLowerCase(); }
function lsp6ElemKey(index: number)   { return LSP6.ARRAY_PREFIX + index.toString(16).padStart(32, "0"); }

// ── ABIs ──────────────────────────────────────────────────────────────────────
const REGISTRY_ABI = [
  "function agentToUP(address) external view returns (address)",
  "function agentToKM(address) external view returns (address)",
  "function registerUP(address agent, address upAddress, address kmAddress) external",
  "function updateReputation(address agent, uint96 accuracy, uint96 verifications) external",
];
const UP_ABI = [
  "function setDataBatch(bytes32[] memory dataKeys, bytes[] memory dataValues) external payable",
  "function transferOwnership(address newOwner) external",
  "function acceptOwnership() external",
  "function owner() external view returns (address)",
];
const KM_ABI = [
  "function execute(bytes calldata payload) external payable returns (bytes memory)",
];

// ── Bytecode loader ───────────────────────────────────────────────────────────
function getUPBytecode(): string { return UniversalProfileArtifact.bytecode as string; }
function getKMBytecode(): string { return LSP6KeyManagerArtifact.bytecode as string; }

// ── Auth ──────────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.COMPOSIA_API_KEY;
  if (!apiKey) return true;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

// ── POST /api/keeper/create-up ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body            = await req.json().catch(() => ({}));
  const agent: string   = body.agent;
  const accuracy        = Number(body.accuracy   ?? 0);
  const verifications   = Number(body.verifications ?? 0);

  if (!agent || !ethers.isAddress(agent)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid agent address" }, { status: 400 });
  }

  // Below-threshold guard (same as /api/keeper)
  if (accuracy < 80 || verifications < 100) {
    return NextResponse.json({ ok: true, skipped: true, reason: "below threshold (accuracy<80 or verifications<100)" });
  }

  const rpc             = process.env.LUKSO_TESTNET_RPC;
  const privateKey      = process.env.COMPOSIA_PRIVATE_KEY;
  const registryAddress = process.env.COMPOSIA_REGISTRY_ADDRESS;

  if (!rpc || !privateKey || !registryAddress) {
    return NextResponse.json({ ok: false, error: "Keeper not configured (need LUKSO_TESTNET_RPC, COMPOSIA_PRIVATE_KEY, COMPOSIA_REGISTRY_ADDRESS)" }, { status: 500 });
  }

  try {
    const provider  = new ethers.JsonRpcProvider(rpc);
    const signer    = new ethers.Wallet(privateKey, provider);
    const signerAddr = await signer.getAddress();
    const registry  = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
    const ZERO      = ethers.ZeroAddress;

    // Idempotency: skip if UP already exists
    const existingUP = await registry.agentToUP(agent).catch(() => ZERO);
    if (existingUP !== ZERO) {
      return NextResponse.json({ ok: true, skipped: true, reason: "UP already registered", upAddress: existingUP });
    }

    // ── Deploy UniversalProfile ───────────────────────────────────────────────
    const upFactory = new ethers.ContractFactory(UP_ABI, getUPBytecode(), signer);
    const up        = await upFactory.deploy(signerAddr);
    await up.waitForDeployment();
    const upAddress = await up.getAddress();

    const joinedAt = Math.floor(Date.now() / 1000);
    const correct  = Math.round((accuracy / 100) * verifications);

    // Build LSP3 + LSP6 data keys
    const repKeys: string[] = [
      LSP3_KEYS.supported, LSP3_KEYS.reputation, LSP3_KEYS.verifications,
      LSP3_KEYS.correct, LSP3_KEYS.lastActivity, LSP3_KEYS.joined,
    ];
    const repVals: string[] = [
      LSP3_KEYS.supported_val,
      ethers.zeroPadValue(ethers.toBeHex(accuracy), 32),
      ethers.zeroPadValue(ethers.toBeHex(verifications), 32),
      ethers.zeroPadValue(ethers.toBeHex(correct), 32),
      ethers.zeroPadValue(ethers.toBeHex(joinedAt), 32),
      ethers.zeroPadValue(ethers.toBeHex(joinedAt), 32),
    ];
    const lsp6Keys: string[] = [
      LSP6.ARRAY_KEY, lsp6ElemKey(0), lsp6ElemKey(1), lsp6PermKey(signerAddr), lsp6PermKey(agent),
    ];
    const lsp6Vals: string[] = [
      ethers.zeroPadValue("0x02", 32),
      ethers.zeroPadValue(signerAddr, 32),
      ethers.zeroPadValue(agent, 32),
      LSP6.SETDATA_PERMS,
      LSP6.ALL_PERMS,
    ];

    const upContract = new ethers.Contract(upAddress, UP_ABI, signer);
    await (await upContract.setDataBatch([...repKeys, ...lsp6Keys], [...repVals, ...lsp6Vals])).wait();

    // ── Deploy LSP6KeyManager ─────────────────────────────────────────────────
    const kmFactory = new ethers.ContractFactory(KM_ABI, getKMBytecode(), signer);
    const km        = await kmFactory.deploy(upAddress);
    await km.waitForDeployment();
    const kmAddress = await km.getAddress();

    // ── 2-step ownership transfer: UP → KM ────────────────────────────────────
    await (await upContract.transferOwnership(kmAddress)).wait();

    const kmContract       = new ethers.Contract(kmAddress, KM_ABI, signer);
    const acceptCalldata   = new ethers.Interface(["function acceptOwnership()"]).encodeFunctionData("acceptOwnership");
    await (await kmContract.execute(acceptCalldata)).wait();

    // ── Pre-initiate agent ownership claim ────────────────────────────────────
    const transferCalldata = new ethers.Interface(["function transferOwnership(address)"]).encodeFunctionData("transferOwnership", [agent]);
    await (await kmContract.execute(transferCalldata)).wait();

    // ── Register in ComposiaRegistry ──────────────────────────────────────────
    await (await registry.registerUP(agent, upAddress, kmAddress)).wait();
    const updateTx = await registry.updateReputation(agent, accuracy, verifications);
    const receipt  = await updateTx.wait();
    const txHash   = receipt.hash;

    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action:    "run",
      step:      "create-up",
      chain:     "lukso",
      agent,
      status:    "created",
      upAddress,
      kmAddress,
      txHash,
    });

    return NextResponse.json({ ok: true, agent, upAddress, kmAddress, txHash });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action: "run",
      step:   "create-up",
      chain:  "lukso",
      agent,
      status: "failed",
      error,
    });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
