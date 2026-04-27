import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const SWARM_ABI = [
  "function getTotalWins(string calldata peerId) external view returns (uint256)",
  "function getVoterVoteCount(string calldata peerId) external view returns (uint256)",
  "function getEoa(string[] calldata peerIds) external view returns (address[] memory)",
  "function currentRound() public view returns (uint256)",
  "function uniqueVoters() public view returns (uint256)",
];

const DEFAULT_RPC      = "https://gensyn-testnet.g.alchemy.com/public";
const DEFAULT_CONTRACT = "0xFaD7C5e93f28257429569B854151A1B8DCD404c2";

export interface GensynAgent {
  peerId: string;
  eoa: string;
  wins: number;
  voteCount: number;
  accuracy: number;
}

export async function GET(req: NextRequest) {
  const url     = new URL(req.url);
  // Optional: comma-separated peer IDs to query specific agents
  const peersParam = url.searchParams.get("peers");
  const peerIds    = peersParam ? peersParam.split(",").map((p) => p.trim()).filter(Boolean) : [];

  const rpc          = process.env.GENSYN_RPC      ?? DEFAULT_RPC;
  const contractAddr = process.env.GENSYN_CONTRACT ?? DEFAULT_CONTRACT;

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const swarm    = new ethers.Contract(contractAddr, SWARM_ABI, provider);

    // Always fetch chain-level stats
    const [currentRound, uniqueVoters] = await Promise.all([
      swarm.currentRound().catch(() => BigInt(0)),
      swarm.uniqueVoters().catch(() => BigInt(0)),
    ]);

    // If no peer IDs provided, return chain stats only
    if (peerIds.length === 0) {
      return NextResponse.json({
        ok:           true,
        agents:       [],
        currentRound: Number(currentRound),
        uniqueVoters: Number(uniqueVoters),
      });
    }

    // ── Query stats for each provided peer ID ────────────────────────────────
    const stats = await Promise.all(
      peerIds.map(async (peerId) => {
        const [wins, voteCount] = await Promise.all([
          swarm.getTotalWins(peerId).catch(() => BigInt(0)),
          swarm.getVoterVoteCount(peerId).catch(() => BigInt(0)),
        ]);
        return { peerId, wins: Number(wins), voteCount: Number(voteCount) };
      })
    );

    // Resolve peer IDs → Ethereum EOA addresses
    const eoaResult: string[] = await swarm.getEoa(peerIds).catch(() => peerIds.map(() => ethers.ZeroAddress));

    const agents: GensynAgent[] = stats.map(({ peerId, wins, voteCount }, i) => {
      const eoa      = eoaResult[i] ?? ethers.ZeroAddress;
      const accuracy = voteCount > 0 ? Math.min(Math.round((wins / voteCount) * 100), 100) : 0;
      return { peerId, eoa, wins, voteCount, accuracy };
    });

    return NextResponse.json({
      ok:           true,
      agents,
      currentRound: Number(currentRound),
      uniqueVoters: Number(uniqueVoters),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), agents: [] },
      { status: 500 }
    );
  }
}
