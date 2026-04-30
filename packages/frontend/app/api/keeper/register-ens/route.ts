import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { keeperLog } from "@/lib/keeper-log";

// ── ABIs (from listener/src/ens-registrar.ts) ─────────────────────────────────
const REGISTRAR_ABI = [
  "function registerSubdomain(string calldata label, address agentEoa, string[] calldata keys, string[] calldata values) external returns (bytes32)",
  "function updateTextRecords(bytes32 node, string[] calldata keys, string[] calldata values) external",
];

const REPUTATION_STATE_ABI = [
  "function registerAgent(address agent, address upAddress, bytes32 ensNode, string calldata label) external",
  "function updateVerificationStatus(bytes32 node, uint256 newReputation, bool shouldBeVerified) external",
  "function syncFollowerCount(bytes32 node, uint256 count) external",
  "function agentToNode(address agent) external view returns (bytes32)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensLabel(address: string): string {
  return address.slice(2, 10).toLowerCase();
}

function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.COMPOSIA_API_KEY;
  if (!apiKey) return true;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

// Text record keys and values for a new subdomain (mirrors ens-registrar.ts)
function buildTextRecords(
  agent: string,
  upAddress: string,
  label: string,
): { keys: string[]; values: string[] } {
  const frontendUrl = process.env.COMPOSIA_FRONTEND_URL ?? "https://composia.app";
  const keys = [
    "gensyn:peerId",
    "gensyn:accuracy",
    "gensyn:verifications",
    "gensyn:up_address",
    "gensyn:followers",
    "gensyn:verified_since",
    "url",
    "name",
    "description",
    "erc8004:agentURI",
    "composia:agent",
  ];
  const values = [
    "",                                                // peerId — updated by listener when available
    "0",                                               // accuracy — updated in step 3
    "0",                                               // verifications — updated in step 3
    upAddress,
    "0",
    String(Math.floor(Date.now() / 1000)),
    `${frontendUrl}/agent/${agent}`,
    `Composia Agent ${label}`,
    `Gensyn ML agent registered via Composia. Profile: ${frontendUrl}/agent/${agent}`,
    `${frontendUrl}/api/erc8004/${agent}`,
    agent,
  ];
  return { keys, values };
}

// ── POST /api/keeper/register-ens ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body              = await req.json().catch(() => ({}));
  const agent: string     = body.agent;
  const upAddress: string = body.upAddress ?? ethers.ZeroAddress;

  if (!agent || !ethers.isAddress(agent)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid agent address" }, { status: 400 });
  }

  const sepoliaRpc     = process.env.ETHEREUM_SEPOLIA_RPC;
  const privateKey     = process.env.DEPLOYER_PRIVATE_KEY;
  const registrarAddr  = process.env.ENS_REGISTRAR_ADDRESS;
  const repStateAddr   = process.env.REPUTATION_STATE_ADDRESS;

  if (!sepoliaRpc || !privateKey || !registrarAddr || !repStateAddr) {
    return NextResponse.json({
      ok: false,
      error: "Not configured (need ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, ENS_REGISTRAR_ADDRESS, REPUTATION_STATE_ADDRESS)",
    }, { status: 500 });
  }

  const label   = ensLabel(agent);
  const ensName = `${label}.composia.eth`;
  const ensNode = ethers.namehash(ensName);

  try {
    const provider = new ethers.JsonRpcProvider(sepoliaRpc);
    const signer   = new ethers.Wallet(privateKey, provider);
    const registrar = new ethers.Contract(registrarAddr, REGISTRAR_ABI, signer);
    const repState  = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, signer);

    // Idempotency: skip if already registered in ReputationState
    const existingNode = await repState.agentToNode(agent).catch(() => ethers.ZeroHash);
    if (existingNode !== ethers.ZeroHash) {
      return NextResponse.json({ ok: true, skipped: true, reason: "agent already registered in ReputationState", ensName, ensNode });
    }

    const { keys, values } = buildTextRecords(agent, upAddress, label);

    // L1: Register ENS subdomain
    const subdomainTx      = await registrar.registerSubdomain(label, agent, keys, values);
    const subdomainReceipt = await subdomainTx.wait();
    const txHash           = subdomainReceipt.hash;

    // L2: Seed ReputationState (parallel — registerAgent, initial updateVerificationStatus, syncFollowerCount)
    await Promise.all([
      repState.registerAgent(agent, upAddress, ensNode, label).then((tx: { wait: () => Promise<unknown> }) => tx.wait()),
      repState.updateVerificationStatus(ensNode, 0, false).then((tx: { wait: () => Promise<unknown> }) => tx.wait()),
      repState.syncFollowerCount(ensNode, 0).then((tx: { wait: () => Promise<unknown> }) => tx.wait()),
    ]);

    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action:    "run",
      step:      "register-ens",
      chain:     "sepolia",
      agent,
      status:    "created",
      ensName,
      txHash,
    });

    return NextResponse.json({ ok: true, ensName, ensNode, txHash });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action: "run",
      step:   "register-ens",
      chain:  "sepolia",
      agent,
      status: "failed",
      error,
    });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
