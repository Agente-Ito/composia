import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { keeperLog } from "@/lib/keeper-log";
import { nsUpdateTexts } from "@/lib/namespace";

// ── ABIs ──────────────────────────────────────────────────────────────────────
const REPUTATION_STATE_ABI = [
  "function updateVerificationStatus(bytes32 node, uint256 newReputation, bool shouldBeVerified) external",
  "function syncFollowerCount(bytes32 node, uint256 count) external",
  "function agentToNode(address agent) external view returns (bytes32)",
  "function getCurrentStatus(bytes32 node) external view returns (uint256 reputation, bool verified, bool slashed, uint256 slashExpiresAt, uint256 followerCount, uint256 lastUpdated)",
];

const SYNCER_ABI = [
  "function receiveMessage(address agent, uint96 accuracy, uint96 verifications) external",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ensLabel(address: string): string { return address.slice(2, 10).toLowerCase(); }

function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.COMPOSIA_API_KEY;
  if (!apiKey) return true;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

// ── POST /api/keeper/update-reputation ───────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body          = await req.json().catch(() => ({}));
  const agent: string = body.agent;
  const accuracy      = Number(body.accuracy      ?? 0);
  const verifications = Number(body.verifications  ?? 0);

  if (!agent || !ethers.isAddress(agent)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid agent address" }, { status: 400 });
  }

  const sepoliaRpc   = process.env.ETHEREUM_SEPOLIA_RPC;
  const privateKey   = process.env.DEPLOYER_PRIVATE_KEY;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  const syncerAddr   = process.env.SYNCER_ETHEREUM_ADDRESS;

  if (!sepoliaRpc || !privateKey || !repStateAddr) {
    return NextResponse.json({
      ok: false,
      error: "Not configured (need ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, REPUTATION_STATE_ADDRESS)",
    }, { status: 500 });
  }

  const label   = ensLabel(agent);
  const ensName = `${label}.composia.eth`;
  const ensNode = ethers.namehash(ensName);
  const repBps  = accuracy * 100;
  const verified = accuracy >= 60;

  try {
    const provider = new ethers.JsonRpcProvider(sepoliaRpc);
    const signer   = new ethers.Wallet(privateKey, provider);
    const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, signer);

    // Read current follower count so we preserve it
    let followerCount = 0;
    try {
      const status = await repState.getCurrentStatus(ensNode);
      followerCount = Number(status.followerCount);
    } catch { /* agent not yet registered — syncFollowerCount(0) is safe */ }

    // L1: gasless text record update via Namespace (fire-and-forget)
    nsUpdateTexts(agent, accuracy, verifications).catch(() => {});

    // L2: on-chain ReputationState update (parallel)
    const repTxs = await Promise.all([
      repState.updateVerificationStatus(ensNode, repBps, verified),
      repState.syncFollowerCount(ensNode, followerCount),
    ]);
    const receipts = await Promise.all(repTxs.map((tx: { wait: () => Promise<{ hash: string }> }) => tx.wait()));
    const txHash   = receipts[0].hash;

    // Optional: sync to SyncerContract (cross-chain bridge record)
    let syncTxHash: string | undefined;
    if (syncerAddr) {
      try {
        const syncer  = new ethers.Contract(syncerAddr, SYNCER_ABI, signer);
        const syncTx  = await syncer.receiveMessage(agent, accuracy, verifications);
        const syncRec = await syncTx.wait();
        syncTxHash    = syncRec.hash;
      } catch { /* non-blocking — sync failure doesn't fail the step */ }
    }

    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action:    "run",
      step:      "update-reputation",
      chain:     "sepolia",
      agent,
      status:    "updated",
      txHash,
    });

    return NextResponse.json({ ok: true, ensNode, repBps, verified, txHash, syncTxHash });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    keeperLog.append({
      timestamp: Math.floor(Date.now() / 1000),
      action: "run",
      step:   "update-reputation",
      chain:  "sepolia",
      agent,
      status: "failed",
      error,
    });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
