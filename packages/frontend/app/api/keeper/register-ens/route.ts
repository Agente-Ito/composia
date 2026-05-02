import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { keeperLog } from "@/lib/keeper-log";
import { nsCreateSubname, nsLabel } from "@/lib/namespace";

const REPUTATION_STATE_ABI = [
  "function registerAgent(address agent, address upAddress, bytes32 ensNode, string label) external",
  "function updateVerificationStatus(bytes32 node, uint256 newReputation, bool shouldBeVerified) external",
  "function syncFollowerCount(bytes32 node, uint256 count) external",
  "function agentToNode(address agent) external view returns (bytes32)",
  "function reputationOracle() external view returns (address)",
  "function owner() external view returns (address)",
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

    // Debug: verify auth before sending tx
    const signerAddr = await signer.getAddress();
    const oracle     = await repState.reputationOracle().catch(() => "unknown");
    const owner      = await repState.owner().catch(() => "unknown");
    console.log(`[register-ens] signer=${signerAddr} oracle=${oracle} owner=${owner}`);

    // Dry-run to surface exact revert reason
    try {
      await repState.registerAgent.staticCall(agent, upAddress, ensNode, label);
    } catch (simErr: unknown) {
      const simMsg = simErr instanceof Error ? simErr.message : String(simErr);
      console.error(`[register-ens] staticCall failed: ${simMsg}`);
      throw new Error(`registerAgent simulation failed: ${simMsg}`);
    }

    // L2: seed ReputationState on-chain (sequential to avoid nonce collisions)
    await (await repState.registerAgent(agent, upAddress, ensNode, label)).wait();
    await (await repState.updateVerificationStatus(ensNode, 0, false)).wait();
    await (await repState.syncFollowerCount(ensNode, 0)).wait();

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
