import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { keeperLog } from "@/lib/keeper-log";
import { nsCreateSubname, nsLabel } from "@/lib/namespace";

const REPUTATION_STATE_ABI = [
  "function registerAgent(address agent, address upAddress, bytes32 ensNode, string label) external",
  "function updateVerificationStatus(bytes32 node, uint256 newReputation, bool shouldBeVerified) external",
  "function syncFollowerCount(bytes32 node, uint256 count) external",
  "function agentToNode(address agent) external view returns (bytes32)",
];

function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.COMPOSIA_API_KEY;
  if (!apiKey) return true;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
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

  const sepoliaRpc   = process.env.ETHEREUM_SEPOLIA_RPC;
  const privateKey   = process.env.DEPLOYER_PRIVATE_KEY;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;

  if (!sepoliaRpc || !privateKey || !repStateAddr) {
    return NextResponse.json({
      ok: false,
      error: "Not configured (need ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, REPUTATION_STATE_ADDRESS)",
    }, { status: 500 });
  }

  const label   = nsLabel(agent);
  const ensName = `${label}.composia.eth`;
  const ensNode = ethers.namehash(ensName);

  try {
    const provider = new ethers.JsonRpcProvider(sepoliaRpc);
    const signer   = new ethers.Wallet(privateKey, provider);
    const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, signer);

    // Idempotency: skip if already registered in ReputationState
    const existingNode = await repState.agentToNode(agent).catch(() => ethers.ZeroHash);
    if (existingNode !== ethers.ZeroHash) {
      return NextResponse.json({ ok: true, skipped: true, reason: "agent already registered", ensName, ensNode });
    }

    // L1: create offchain ENS subname via Namespace SDK (gasless)
    const nsOk = await nsCreateSubname({ agentEoa: agent, upAddress, accuracy: 0, verifications: 0 });
    if (!nsOk) console.warn(`[register-ens] Namespace subname creation failed for ${label} — continuing with L2`);

    // L2: seed ReputationState on-chain (sequential, explicit gas to avoid OOG on cold slots)
    const GAS = 300000;
    await (await repState.registerAgent(agent, upAddress, ensNode, label, { gasLimit: GAS })).wait();
    await (await repState.updateVerificationStatus(ensNode, 0, false, { gasLimit: GAS })).wait();
    await (await repState.syncFollowerCount(ensNode, 0, { gasLimit: GAS })).wait();

    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action:    "run",
      step:      "register-ens",
      chain:     "sepolia",
      agent,
      status:    "created",
      ensName,
    });

    return NextResponse.json({ ok: true, ensName, ensNode, namespace: nsOk });
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
