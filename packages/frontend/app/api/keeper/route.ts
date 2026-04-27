import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import path from "path";
import fs from "fs";

// ── LSP3 keys (keccak256 of human-readable names) ────────────────────────────
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

// ── LSP6 permission keys (from erc725.js LSP6KeyManager.json schema) ─────────
const LSP6 = {
  // keccak256("AddressPermissions[]")
  ARRAY_KEY:    "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3",
  // first 16 bytes of above → array element prefix
  ARRAY_PREFIX: "0xdf30dba06db6a30e65354d9a64c60986",
  // MappingWithGrouping prefix from schema: "0x4b80742de2bf82acb3630000<address>"
  PERMS_PREFIX: "0x4b80742de2bf82acb3630000",
  // encodePermissions({ CHANGEOWNER, ADDCONTROLLER, EDITPERMISSIONS, ... all except REENTRANCY/DELEGATECALL })
  ALL_PERMS:    "0x0000000000000000000000000000000000000000000000000000000000673f7f",
  // encodePermissions({ SETDATA: true, SUPER_SETDATA: true })
  SETDATA_PERMS:"0x0000000000000000000000000000000000000000000000000000000000060000",
};

function lsp6PermKey(address: string): string {
  return LSP6.PERMS_PREFIX + address.slice(2).toLowerCase();
}
function lsp6ElemKey(index: number): string {
  return LSP6.ARRAY_PREFIX + index.toString(16).padStart(32, "0");
}

// ── Contract ABIs ─────────────────────────────────────────────────────────────
const MOCK_GENSYN_ABI = [
  "event VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)",
];
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
// LSP6KeyManager v0.15.0: execute-only, no ownership functions on the KM itself
const KM_ABI = [
  "function execute(bytes calldata payload) external payable returns (bytes memory)",
];

// ── Artifact loader (resolved at runtime from Next.js cwd = packages/frontend) ─
let _upBytecode: string | null = null;
let _kmBytecode: string | null = null;

function readArtifact(name: string): string {
  const p = path.join(
    process.cwd(),
    "../../packages/contracts/node_modules/@lukso/lsp-smart-contracts/artifacts",
    `${name}.json`
  );
  return JSON.parse(fs.readFileSync(p, "utf8")).bytecode as string;
}

function getUPBytecode(): string {
  if (!_upBytecode) _upBytecode = readArtifact("UniversalProfile");
  return _upBytecode;
}
function getKMBytecode(): string {
  if (!_kmBytecode) _kmBytecode = readArtifact("LSP6KeyManager");
  return _kmBytecode;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface KeeperEvent {
  agent: string;
  accuracy: number;
  verifications: number;
  blockNumber: number;
  txHash: string;
  hasUP: boolean;
  upAddress?: string;
}

export interface KeeperRunResult {
  agent: string;
  action: "created" | "updated" | "skipped" | "error";
  upAddress?: string;
  kmAddress?: string;
  error?: string;
}

// ── Core keeper logic ─────────────────────────────────────────────────────────
async function scanEvents(
  provider: ethers.JsonRpcProvider,
  gensynAddress: string,
  registryAddress: string,
  lookbackBlocks: number
): Promise<KeeperEvent[]> {
  const currentBlock = await provider.getBlockNumber();
  const fromBlock    = Math.max(0, currentBlock - lookbackBlocks);

  const contract  = new ethers.Contract(gensynAddress, MOCK_GENSYN_ABI, provider);
  const filter    = contract.filters.VerificationCompleted();
  const rawLogs   = await provider.getLogs({
    ...filter,
    fromBlock,
    toBlock: "latest",
  });

  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
  const ZERO     = ethers.ZeroAddress;

  // Deduplicate: keep only the LAST event per agent
  const latest = new Map<string, (typeof rawLogs)[0]>();
  for (const log of rawLogs) {
    latest.set(log.topics[1]?.toLowerCase() ?? "", log);
  }

  const events: KeeperEvent[] = [];
  for (const log of Array.from(latest.values())) {
    const iface    = contract.interface;
    const parsed   = iface.parseLog({ topics: log.topics as string[], data: log.data });
    if (!parsed) continue;

    const agent        = parsed.args[0] as string;
    const accuracy     = Number(parsed.args[1]);
    const verifications = Number(parsed.args[2]);
    const upAddress    = await registry.agentToUP(agent).catch(() => ZERO);
    const hasUP        = upAddress !== ZERO;

    events.push({
      agent,
      accuracy,
      verifications,
      blockNumber: log.blockNumber,
      txHash:      log.transactionHash,
      hasUP,
      upAddress:   hasUP ? upAddress : undefined,
    });
  }

  return events.sort((a, b) => b.blockNumber - a.blockNumber);
}

async function processAgent(
  signer: ethers.Wallet,
  registryAddress: string,
  event: KeeperEvent
): Promise<KeeperRunResult> {
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
  const signerAddr = await signer.getAddress();

  try {
    if (!event.hasUP) {
      // ── CREATE: deploy UP + KM, set permissions, register ──────────────────
      const upFactory = new ethers.ContractFactory(UP_ABI, getUPBytecode(), signer);
      const up        = await upFactory.deploy(signerAddr);
      await up.waitForDeployment();
      const upAddress = await up.getAddress();

      const joinedAt = Math.floor(Date.now() / 1000);
      const correct  = Math.round((event.accuracy / 100) * event.verifications);
      const now      = joinedAt;

      // Build data keys: reputation + LSP3 standard + LSP6 permissions
      const repKeys: string[] = [
        LSP3_KEYS.supported, LSP3_KEYS.reputation, LSP3_KEYS.verifications,
        LSP3_KEYS.correct, LSP3_KEYS.lastActivity, LSP3_KEYS.joined,
      ];
      const repVals: string[] = [
        LSP3_KEYS.supported_val,
        ethers.zeroPadValue(ethers.toBeHex(event.accuracy), 32),
        ethers.zeroPadValue(ethers.toBeHex(event.verifications), 32),
        ethers.zeroPadValue(ethers.toBeHex(correct), 32),
        ethers.zeroPadValue(ethers.toBeHex(now), 32),
        ethers.zeroPadValue(ethers.toBeHex(joinedAt), 32),
      ];

      const lsp6Keys: string[] = [
        LSP6.ARRAY_KEY,
        lsp6ElemKey(0),
        lsp6ElemKey(1),
        lsp6PermKey(signerAddr),
        lsp6PermKey(event.agent),
      ];
      const lsp6Vals: string[] = [
        ethers.zeroPadValue("0x02", 32),
        ethers.zeroPadValue(signerAddr, 32),
        ethers.zeroPadValue(event.agent, 32),
        LSP6.SETDATA_PERMS,
        LSP6.ALL_PERMS,
      ];

      const upContract = new ethers.Contract(upAddress, UP_ABI, signer);
      await (await upContract.setDataBatch([...repKeys, ...lsp6Keys], [...repVals, ...lsp6Vals])).wait();

      const kmFactory = new ethers.ContractFactory(KM_ABI, getKMBytecode(), signer);
      const km        = await kmFactory.deploy(upAddress);
      await km.waitForDeployment();
      const kmAddress = await km.getAddress();

      const kmContract  = new ethers.Contract(kmAddress, KM_ABI, signer);
      await (await upContract.transferOwnership(kmAddress)).wait();

      const acceptCalldata = new ethers.Interface(["function acceptOwnership()"]).encodeFunctionData("acceptOwnership");
      await (await kmContract.execute(acceptCalldata)).wait();

      // Pre-initiate UP ownership transfer through KM so agent claims via UP.acceptOwnership() directly
      const transferOwnerCalldata = new ethers.Interface(["function transferOwnership(address)"]).encodeFunctionData("transferOwnership", [event.agent]);
      await (await kmContract.execute(transferOwnerCalldata)).wait();

      await (await registry.registerUP(event.agent, upAddress, kmAddress)).wait();
      await (await registry.updateReputation(event.agent, event.accuracy, event.verifications)).wait();

      return { agent: event.agent, action: "created", upAddress, kmAddress };
    } else {
      // ── UPDATE: write new reputation data through KM ────────────────────────
      const kmAddress = await registry.agentToKM(event.agent);
      const correct   = Math.round((event.accuracy / 100) * event.verifications);
      const now       = Math.floor(Date.now() / 1000);

      const keys: string[] = [
        LSP3_KEYS.reputation, LSP3_KEYS.verifications,
        LSP3_KEYS.correct, LSP3_KEYS.lastActivity,
      ];
      const vals: string[] = [
        ethers.zeroPadValue(ethers.toBeHex(event.accuracy), 32),
        ethers.zeroPadValue(ethers.toBeHex(event.verifications), 32),
        ethers.zeroPadValue(ethers.toBeHex(correct), 32),
        ethers.zeroPadValue(ethers.toBeHex(now), 32),
      ];

      const upInterface = new ethers.Interface([
        "function setDataBatch(bytes32[] memory dataKeys, bytes[] memory dataValues) external payable",
      ]);
      const calldata = upInterface.encodeFunctionData("setDataBatch", [keys, vals]);

      const km = new ethers.Contract(kmAddress, KM_ABI, signer);
      await (await km.execute(calldata)).wait();
      await (await registry.updateReputation(event.agent, event.accuracy, event.verifications)).wait();

      return { agent: event.agent, action: "updated", upAddress: event.upAddress, kmAddress };
    }
  } catch (err: unknown) {
    return {
      agent:  event.agent,
      action: "error",
      error:  err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.ATTESTOR_API_KEY;
  if (apiKey) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const action:        "scan" | "run" = body.action ?? "scan";
  const lookbackBlocks: number        = body.lookbackBlocks ?? 500;

  const rpc             = process.env.LUKSO_TESTNET_RPC;
  const privateKey      = process.env.ATTESTOR_PRIVATE_KEY;
  const gensynAddress   = process.env.MOCK_GENSYN_ADDRESS;
  const registryAddress = process.env.ATTESTOR_REGISTRY_ADDRESS;

  if (!rpc || !gensynAddress || !registryAddress) {
    return NextResponse.json({
      ok: false,
      error: "Keeper not configured (need LUKSO_TESTNET_RPC, MOCK_GENSYN_ADDRESS, ATTESTOR_REGISTRY_ADDRESS)",
      configured: false,
      events: [],
      results: [],
    });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const events   = await scanEvents(provider, gensynAddress, registryAddress, lookbackBlocks);

    if (action === "scan") {
      return NextResponse.json({ ok: true, configured: true, events, results: [] });
    }

    if (!privateKey) {
      return NextResponse.json({
        ok: false,
        error: "ATTESTOR_PRIVATE_KEY not set — cannot process events",
        configured: true,
        events,
        results: [],
      });
    }

    const signer   = new ethers.Wallet(privateKey, provider);
    // Only create UPs for agents that meet the quality threshold
    const eligible = events.filter((e) => !e.hasUP && e.accuracy >= 80 && e.verifications >= 100);
    const results: KeeperRunResult[] = [];

    for (const event of eligible) {
      const result = await processAgent(signer, registryAddress, event);
      results.push(result);
    }

    return NextResponse.json({ ok: true, configured: true, events, results });
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      configured: true,
      events: [],
      results: [],
    });
  }
}
