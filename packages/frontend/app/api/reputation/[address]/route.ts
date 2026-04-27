import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const REPUTATION_STATE_ABI = [
  "function getCurrentStatus(bytes32 node) external view returns (uint256 reputation, bool verified, bool slashed, uint256 slashExpiresAt, uint256 followerCount, uint256 lastUpdated)",
  "function getQuorum(bytes32 node) external view returns (uint256)",
  "function isCurrentlyVerified(bytes32 node) external view returns (bool)",
  "function verificationThreshold() external view returns (uint256)",
];

function ensLabel(address: string): string {
  return address.slice(2, 10).toLowerCase();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const rpc          = process.env.ETHEREUM_SEPOLIA_RPC;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;

  if (!rpc || !repStateAddr) {
    return NextResponse.json({
      configured: false,
      ensName: `${ensLabel(address)}.composia.eth`,
      message: "REPUTATION_STATE_ADDRESS not configured",
    });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, provider);

    const label   = ensLabel(address);
    const ensName = `${label}.composia.eth`;
    const node    = ethers.namehash(ensName);

    const [status, quorum, threshold] = await Promise.all([
      repState.getCurrentStatus(node),
      repState.getQuorum(node),
      repState.verificationThreshold(),
    ]);

    const reputation     = Number(status.reputation);
    const reputationPct  = reputation / 100;
    const slashExpiresAt = Number(status.slashExpiresAt);
    const followerCount  = Number(status.followerCount);
    const lastUpdated    = Number(status.lastUpdated);

    return NextResponse.json({
      configured:    true,
      ensName,
      ensNode:       node,
      address:       repStateAddr,
      // Reactive state
      reputation,               // basis points (8500 = 85%)
      reputationPct,            // human-readable (85.0)
      verified:      status.verified,
      slashed:       status.slashed,
      slashExpiresAt,
      followerCount,
      quorum:        Number(quorum),
      threshold:     Number(threshold),    // verification threshold in bps
      thresholdPct:  Number(threshold) / 100,
      lastUpdated,
      // Computed helpers for UI
      slashTimeRemaining: status.slashed && slashExpiresAt > 0
        ? Math.max(0, slashExpiresAt - Math.floor(Date.now() / 1000))
        : 0,
      meetsThreshold: reputation >= Number(threshold),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), configured: true },
      { status: 500 }
    );
  }
}

// Slash an agent (admin / governance)
export async function POST(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  const apiKey = process.env.ATTESTOR_API_KEY;
  if (apiKey) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? "slash";

  const rpc          = process.env.ETHEREUM_SEPOLIA_RPC;
  const pk           = process.env.DEPLOYER_PRIVATE_KEY;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;

  if (!rpc || !pk || !repStateAddr) {
    return NextResponse.json({ error: "REPUTATION_STATE_ADDRESS not configured" }, { status: 500 });
  }

  const node = ethers.namehash(`${ensLabel(address)}.composia.eth`);

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const signer   = new ethers.Wallet(pk, provider);
    const repState = new ethers.Contract(repStateAddr, [
      "function slashAgent(bytes32 node, uint256 durationSeconds, string calldata reason) external",
      "function restoreAgent(bytes32 node) external",
      "function settleSlash(bytes32 node) external",
    ], signer);

    let tx;
    if (action === "slash") {
      const duration: number = body.duration ?? 7 * 86400; // default 7 days
      const reason:   string = body.reason   ?? "Governance decision";
      tx = await repState.slashAgent(node, duration, reason);
    } else if (action === "restore") {
      tx = await repState.restoreAgent(node);
    } else if (action === "settle") {
      tx = await repState.settleSlash(node);
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const receipt = await tx.wait();
    return NextResponse.json({ success: true, txHash: receipt.hash, action });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
