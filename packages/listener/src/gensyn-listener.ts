import { ethers } from "ethers";
import { enqueue } from "./queue";

// ── Mock listener (LUKSO testnet) ─────────────────────────────────────────────

const MOCK_GENSYN_ABI = [
  "event VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)",
];

export class GensynListener {
  private contract: ethers.Contract;
  private provider: ethers.Provider;

  constructor(
    private readonly contractAddress: string,
    provider: ethers.Provider
  ) {
    this.provider = provider;
    this.contract = new ethers.Contract(contractAddress, MOCK_GENSYN_ABI, provider);
  }

  start(): void {
    console.log(`[gensyn-listener] Listening to MockGensyn at ${this.contractAddress}`);

    this.contract.on(
      "VerificationCompleted",
      (agent: string, accuracy: bigint, verifications: bigint) => {
        console.log(
          `[gensyn-listener] Event: agent=${agent} accuracy=${accuracy}% verifications=${verifications}`
        );
        enqueue(agent, Number(accuracy), Number(verifications));
      }
    );

    this.provider.on("error", (err: Error) => {
      console.error("[gensyn-listener] Provider error:", err.message);
    });
  }

  stop(): void {
    this.contract.removeAllListeners();
    console.log("[gensyn-listener] Stopped");
  }
}

// ── Real Gensyn listener (Chain ID 685685) ────────────────────────────────────
//
// Contract: 0x7745a8FE4b8D2D2c3BB103F8dCae822746F35Da0
// Events used:
//   PeerRegistered(address indexed eoa, string peerId)
//   CumulativeRewardsUpdated(address indexed account, string peerId, int256 totalRewards)
//
// Mapping to Composia fields:
//   accuracy     = log-normalized totalRewards → 0-100
//   verifications = number of CumulativeRewardsUpdated events seen for this EOA (≈ rounds)

const REAL_GENSYN_ABI = [
  "event PeerRegistered(address indexed eoa, string peerId)",
  "event CumulativeRewardsUpdated(address indexed account, string peerId, int256 totalRewards)",
];

// Log-normalize an unbounded reward value into 0–100.
// Calibrated so that ~1M rewards → 100, ~1 reward → ~0.
const LOG_SCALE_MAX = 6; // log10(1_000_000)
function normalizeRewards(totalRewards: bigint): number {
  const n = Number(totalRewards);
  if (n <= 0) return 0;
  const score = (Math.log10(n) / LOG_SCALE_MAX) * 100;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export class RealGensynListener {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  // eoa → peerId (from PeerRegistered)
  private peerIdMap: Map<string, string> = new Map();
  // eoa → round count (incremented on each CumulativeRewardsUpdated)
  private roundCount: Map<string, number> = new Map();

  constructor(
    private readonly contractAddress: string,
    provider: ethers.Provider
  ) {
    this.provider = provider;
    this.contract = new ethers.Contract(contractAddress, REAL_GENSYN_ABI, provider);
  }

  start(): void {
    console.log(`[gensyn-listener] Listening to real Gensyn chain at ${this.contractAddress}`);

    // Cache peerId when a peer registers their EOA
    this.contract.on("PeerRegistered", (eoa: string, peerId: string) => {
      const key = eoa.toLowerCase();
      this.peerIdMap.set(key, peerId);
      console.log(`[gensyn-listener] PeerRegistered: ${eoa} → ${peerId}`);
    });

    // Main event: fires each time cumulative rewards are updated for an EOA
    this.contract.on(
      "CumulativeRewardsUpdated",
      (account: string, peerId: string, totalRewards: bigint) => {
        const key = account.toLowerCase();

        // Update peerId mapping if not already set
        if (!this.peerIdMap.has(key)) {
          this.peerIdMap.set(key, peerId);
        }

        // Increment round counter for this EOA
        const rounds = (this.roundCount.get(key) ?? 0) + 1;
        this.roundCount.set(key, rounds);

        const accuracy = normalizeRewards(totalRewards);
        const resolvedPeerId = this.peerIdMap.get(key) ?? peerId;

        console.log(
          `[gensyn-listener] CumulativeRewardsUpdated: account=${account} peerId=${resolvedPeerId} totalRewards=${totalRewards} → accuracy=${accuracy}% rounds=${rounds}`
        );

        enqueue(account, accuracy, rounds, resolvedPeerId);
      }
    );

    this.provider.on("error", (err: Error) => {
      console.error("[gensyn-listener] Provider error:", err.message);
    });
  }

  stop(): void {
    this.contract.removeAllListeners();
    console.log("[gensyn-listener] Stopped");
  }
}
