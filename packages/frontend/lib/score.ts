/**
 * Composia Score — multidimensional reputation engine
 *
 * 5-component weighted score replaces the raw Gensyn accuracy%.
 *
 * Weights:
 *   Accuracy     35%   — Bayesian-adjusted accuracy (needs ≥100 verifications for full trust)
 *   Consistency  25%   — Career utilization proxy (verif/day rate × career confidence)
 *   Volume       15%   — Log-scale verification count (diminishing returns)
 *   Activity     15%   — Exponential decay from last update (half-life ≈ 30 days)
 *   Network      10%   — LSP26 followers + endorsements (quality-weighted)
 *
 * NOTE on Consistency:
 *   True consistency requires per-period accuracy history which is not yet stored on-chain.
 *   The current proxy uses career utilization rate (verifications ÷ career days) combined
 *   with career confidence and inactivity penalty. Replace with real stdDev once the keeper
 *   stores weekly accuracy snapshots via `gensyn:accuracy_history`.
 *
 * NOTE on Network quality:
 *   Fetching each follower's reputation is O(N) on-chain reads.
 *   Until a cached follower-quality index exists, we default avgFollowerReputation to 50.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScoreComponents {
  /** Bayesian-adjusted accuracy (0-100) */
  accuracy: number;
  /** Career utilization consistency proxy (0-100) */
  consistency: number;
  /** Log-scale verification volume (0-100) */
  volume: number;
  /** Exponential-decay recency score (0-100) */
  activity: number;
  /** LSP26 follower-based network trust (0-100) */
  network: number;
}

export type ScoreTier = "elite" | "trustworthy" | "developing" | "new";

export interface ScoreTierInfo {
  tier: ScoreTier;
  label: string;
  color: string;   // Tailwind / CSS hex for UI
  description: string;
}

export interface ComposiaScore {
  /** Weighted composite (0-100, 2 decimal places) */
  total: number;
  components: ScoreComponents;
  tier: ScoreTier;
  tierLabel: string;
  tierColor: string;
  /** True when activity trend is upward (+5 bonus was applied) */
  trendBonus: boolean;
}

export interface ScoreInput {
  // On-chain data (always available from Gensyn/Registry)
  accuracy: number;        // 0-100
  verifications: number;   // total count
  correct: number;
  joinedAt: number;        // unix seconds
  lastUpdated: number;     // unix seconds

  // Optional social data (LSP26)
  followerCount?: number;
  avgFollowerReputation?: number; // 0-100, defaults to 50
  endorsementCount?: number;

  // Optional override for mock/preview agents (bypass proxy formulas)
  overrides?: Partial<ScoreComponents>;

  // Whether the verification rate is trending up (from activityTimeline)
  trendingUp?: boolean;

  // For streak bonus
  consecutiveDaysActive?: number;
}

// ── Weights (kept as const so UI can import them) ────────────────────────────

export const SCORE_WEIGHTS = {
  accuracy:    0.35,
  consistency: 0.25,
  volume:      0.15,
  activity:    0.15,
  network:     0.10,
} as const;

// ── Tier definitions ─────────────────────────────────────────────────────────

const TIERS: ScoreTierInfo[] = [
  {
    tier: "elite",
    label: "Elite",
    color: "#00FF88",
    description: "Exceptional track record. High trust, high volume, consistently active.",
  },
  {
    tier: "trustworthy",
    label: "Trustworthy",
    color: "#00D4FF",
    description: "Reliable and well-established. Good basis for agent collaboration.",
  },
  {
    tier: "developing",
    label: "Developing",
    color: "#FFC033",
    description: "Building a track record. Validate before high-stakes work.",
  },
  {
    tier: "new",
    label: "New / Unproven",
    color: "#FF4060",
    description: "Insufficient history. No established reliability signal.",
  },
];

export function getTierInfo(total: number): ScoreTierInfo {
  if (total >= 90) return TIERS[0];
  if (total >= 75) return TIERS[1];
  if (total >= 60) return TIERS[2];
  return TIERS[3];
}

// ── Component calculators ────────────────────────────────────────────────────

/**
 * ACCURACY (35%)
 * Bayesian-adjusted: raw accuracy × sample confidence.
 * sample confidence = min(1, verifications / 100)
 * An agent with 95% accuracy over 10 verifications scores 47.5, not 95.
 */
export function calcAccuracyScore(accuracy: number, verifications: number): number {
  if (verifications === 0 || accuracy <= 0) return 0;
  const sampleConfidence = Math.min(1, verifications / 100);
  return Math.min(100, accuracy * sampleConfidence);
}

/**
 * CONSISTENCY (25%)
 * Career utilization proxy — uses verifications÷career-days rate.
 *
 * Rate is log-normalized (10+ verifs/day → 100).
 * Scaled by career confidence (≥30 days for full trust).
 * Penalized for recent inactivity (−up-to-40pts after 7-day gap).
 *
 * TODO: replace with real stdDev once weekly accuracy history is stored on-chain.
 */
export function calcConsistencyScore(
  verifications: number,
  joinedAt: number,
  lastUpdated: number,
): number {
  const nowSec = Date.now() / 1000;
  const careerDays     = Math.max(1, (nowSec - joinedAt) / 86400);
  const daysSinceActive = Math.max(0, (nowSec - lastUpdated) / 86400);

  // Daily verification rate, log-normalized: 10/day → 100, 1/day → ~50, 0.1/day → ~0
  const dailyRate = verifications / careerDays;
  const rateScore = Math.max(0, Math.min(100, Math.log10(dailyRate + 0.1) * 50 + 50));

  // Career confidence: need ≥30 days of history before trusting the rate
  const careerConfidence = Math.min(1, careerDays / 30);

  // Inactivity penalty: starts after 7-day gap, up to −40 pts over the next 30 days
  const inactivityPenalty = Math.min(40, Math.max(0, (daysSinceActive - 7) / 30) * 40);

  return Math.max(0, Math.min(100, rateScore * careerConfidence - inactivityPenalty));
}

/**
 * VOLUME (15%)
 * Log10 scale — diminishing returns prevent raw count from dominating.
 * 100k+ verifications → 100pts.
 *
 * Thresholds:
 *   1      →  6
 *   10     → 21
 *   100    → 40
 *   1 000  → 60
 *   10 000 → 80
 *   100 000→ 100 (capped)
 */
export function calcVolumeScore(verifications: number): number {
  if (verifications <= 0) return 0;
  return Math.min(100, Math.log10(verifications + 1) * 20);
}

/**
 * ACTIVITY (15%)
 * Exponential decay from last verified update (half-life ≈ 30 days).
 * Streak bonus (+10) for ≥30 consecutive days active.
 * Total is capped at 100.
 */
export function calcActivityScore(lastUpdated: number, consecutiveDaysActive = 0): number {
  const daysSince = Math.max(0, (Date.now() / 1000 - lastUpdated) / 86400);
  const base = 100 * Math.exp(-daysSince / 30);
  const streakBonus = consecutiveDaysActive >= 30 ? 10 : 0;
  return Math.min(100, base + streakBonus);
}

/**
 * NETWORK (10%)
 * Weighted combination of:
 *   A. Follower quantity — log scale (40% weight)
 *   B. Follower quality  — avg reputation of followers (40% weight)
 *   C. Endorsement ratio — endorsements ÷ followers (20% weight)
 *
 * Without quality data, avgFollowerReputation defaults to 50 (neutral).
 */
export function calcNetworkScore(
  followerCount: number,
  avgFollowerReputation = 50,
  endorsementCount = 0,
): number {
  if (followerCount <= 0) {
    // Minimal score even with 0 followers to avoid total collapse of new agents
    return 0;
  }
  const followerScore    = Math.min(100, Math.log10(followerCount + 1) * 20);
  const qualityScore     = Math.min(100, avgFollowerReputation * 0.8);
  const endorsementRatio = Math.min(1, endorsementCount / followerCount);
  const endorsementScore = endorsementRatio * 100;

  return Math.min(100,
    followerScore    * 0.4 +
    qualityScore     * 0.4 +
    endorsementScore * 0.2,
  );
}

// ── Composite ────────────────────────────────────────────────────────────────

export function calculateComposiaScore(input: ScoreInput): ComposiaScore {
  const {
    accuracy,
    verifications,
    joinedAt,
    lastUpdated,
    followerCount         = 0,
    avgFollowerReputation = 50,
    endorsementCount      = 0,
    consecutiveDaysActive = 0,
    trendingUp            = false,
    overrides,
  } = input;

  const accuracyRaw    = calcAccuracyScore(accuracy, verifications);
  const consistencyRaw = calcConsistencyScore(verifications, joinedAt, lastUpdated);
  const volumeRaw      = calcVolumeScore(verifications);
  const activityRaw    = calcActivityScore(lastUpdated, consecutiveDaysActive);
  const networkRaw     = calcNetworkScore(followerCount, avgFollowerReputation, endorsementCount);

  // Allow preview/mock overrides for individual components
  const acc  = Math.round((overrides?.accuracy    ?? accuracyRaw)    * 10) / 10;
  const cons = Math.round((overrides?.consistency ?? consistencyRaw) * 10) / 10;
  const vol  = Math.round((overrides?.volume      ?? volumeRaw)      * 10) / 10;
  let   act  = Math.round((overrides?.activity    ?? activityRaw)    * 10) / 10;
  const net  = Math.round((overrides?.network     ?? networkRaw)     * 10) / 10;

  // Upward trend bonus: +5 on activity component (already capped at 100)
  const trendBonus = trendingUp;
  if (trendBonus) act = Math.min(100, act + 5);

  const components: ScoreComponents = { accuracy: acc, consistency: cons, volume: vol, activity: act, network: net };

  const total = Math.round((
    acc  * SCORE_WEIGHTS.accuracy    +
    cons * SCORE_WEIGHTS.consistency +
    vol  * SCORE_WEIGHTS.volume      +
    act  * SCORE_WEIGHTS.activity    +
    net  * SCORE_WEIGHTS.network
  ) * 100) / 100;

  const tierInfo = getTierInfo(total);

  return {
    total,
    components,
    tier:      tierInfo.tier,
    tierLabel: tierInfo.label,
    tierColor: tierInfo.color,
    trendBonus,
  };
}
