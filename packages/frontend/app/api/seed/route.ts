import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import type { GensynAgent } from "../gensyn/route";

const MOCK_GENSYN_ABI = [
  "function simulateBatch(address[] calldata agents, uint256[] calldata accuracies, uint256[] calldata verificationCounts) external",
];

export async function POST(req: NextRequest) {
  const body               = await req.json().catch(() => ({}));
  const limit: number      = Math.min(body.limit ?? 20, 50);
  const minWins: number    = body.minWins ?? 1;
  const minVotes: number   = body.minVotes ?? 1;

  const rpc  = process.env.LUKSO_TESTNET_RPC;
  const pk   = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.MOCK_GENSYN_ADDRESS;

  if (!rpc || !pk || !addr) {
    return NextResponse.json({ success: false, error: "MockGensyn not configured (need LUKSO_TESTNET_RPC, DEPLOYER_PRIVATE_KEY, MOCK_GENSYN_ADDRESS)" });
  }

  try {
    // ── 1. Fetch real Gensyn data ────────────────────────────────────────────
    const base      = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const gensynRes = await fetch(`${base}/api/gensyn?limit=${limit}`);
    const gensynData = await gensynRes.json();

    if (!gensynData.ok) {
      return NextResponse.json({ success: false, error: `Gensyn fetch failed: ${gensynData.error}` });
    }

    const allAgents: GensynAgent[] = gensynData.agents ?? [];

    // ── 2. Filter: valid EOA, non-zero, meets thresholds ────────────────────
    const eligible = allAgents.filter((a) =>
      ethers.isAddress(a.eoa) &&
      a.eoa !== ethers.ZeroAddress &&
      a.wins    >= minWins  &&
      a.voteCount >= minVotes
    );

    if (eligible.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No eligible agents (${allAgents.length} found, none passed filters minWins=${minWins} minVotes=${minVotes})`,
      });
    }

    // ── 3. Call MockGensyn.simulateBatch on Lukso testnet ───────────────────
    const provider = new ethers.JsonRpcProvider(rpc);
    const signer   = new ethers.Wallet(pk, provider);
    const contract = new ethers.Contract(addr, MOCK_GENSYN_ABI, signer);

    const agents        = eligible.map((a) => a.eoa);
    const accuracies    = eligible.map((a) => a.accuracy);
    const verifications = eligible.map((a) => a.voteCount);

    const tx      = await contract.simulateBatch(agents, accuracies, verifications);
    const receipt = await tx.wait();

    return NextResponse.json({
      success:    true,
      txHash:     receipt.hash,
      count:      eligible.length,
      skipped:    allAgents.length - eligible.length,
      currentRound: gensynData.currentRound,
      agents:     eligible.map((a) => ({
        peerId:    a.peerId,
        eoa:       a.eoa,
        wins:      a.wins,
        voteCount: a.voteCount,
        accuracy:  a.accuracy,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
