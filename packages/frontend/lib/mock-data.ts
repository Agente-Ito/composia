import type {
  Specialization,
  SocialGraph,
  ReliabilityMetrics,
  AgentHistory,
  MonthActivity,
  Collaborator,
} from "./types";

// Deterministic hash — same address always produces the same values
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function fh(address: string, field: string): number {
  return djb2(address.toLowerCase() + ":" + field);
}

function ranged(h: number, min: number, max: number): number {
  return min + (h % (max - min + 1));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getExpertise(accuracy: number): "High" | "Medium" | "Low" {
  if (accuracy >= 75) return "High";
  if (accuracy >= 55) return "Medium";
  return "Low";
}

// Derive a plausible-looking collaborator address from the agent address
function derivedAddress(address: string, index: number): string {
  const parts = [
    fh(address, `c${index}a`).toString(16).padStart(8, "0"),
    fh(address, `c${index}b`).toString(16).padStart(8, "0"),
    fh(address, `c${index}c`).toString(16).padStart(8, "0"),
    fh(address, `c${index}d`).toString(16).padStart(8, "0"),
    fh(address, `c${index}e`).toString(16).padStart(8, "0"),
  ];
  return "0x" + parts.join("").slice(0, 40);
}

const DOMAIN_KEYS = ["codeReasoning", "mathReasoning", "logicReasoning"] as const;

const LANGUAGE_SETS = [
  ["Solidity", "Python", "JavaScript"],
  ["Python", "JavaScript", "TypeScript"],
  ["Rust", "Python", "Go"],
  ["JavaScript", "TypeScript", "Solidity"],
  ["Python", "Solidity", "Rust"],
];

const NODE_TYPES = ["Verifier", "Validator", "Solver", "Compute", "Reasoning"];

// Stable preview seed — deterministic from address, no contract needed
export function previewCoreData(address: string) {
  const seed = parseInt(address.slice(2, 10), 16) || 0;
  const threeMonthsAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
  const joinedAt = threeMonthsAgo - (seed % (30 * 86400));
  const accuracy = 70 + (seed % 30);        // 70–99
  const verifications = 200 + (seed % 800); // 200–999
  return { accuracy, verifications, joinedAt };
}

export interface ExtendedAgentData {
  consistency: "stable" | "rising" | "declining";
  trend: string;
  specialization: Specialization;
  socialGraph: SocialGraph;
  reliability: ReliabilityMetrics;
  history: AgentHistory;
  activityTimeline: MonthActivity[];
}

export function generateMockExtendedData(
  address: string,
  core: { accuracy: number; verifications: number; joinedAt: number }
): ExtendedAgentData {
  const seed = fh(address, "seed");

  // Consistency & trend
  const consistencyOptions = ["stable", "rising", "stable", "rising", "declining"] as const;
  const consistency = consistencyOptions[seed % consistencyOptions.length];
  const trendDelta = ranged(fh(address, "trend"), 1, 7);
  const trend = consistency === "declining" ? `-${trendDelta}%` : `+${trendDelta}%`;

  // Best domain index (0=code, 1=math, 2=logic)
  const bestIdx = seed % 3;
  const bestDomainKey = DOMAIN_KEYS[bestIdx];
  const isSpecialist = seed % 3 !== 0; // 2/3 of agents are domain-specialists

  // Domain accuracies: best domain ≥ core, others drop by varying amounts
  const domainAccuracies = DOMAIN_KEYS.map((_, i) => {
    const h = fh(address, `dacc${i}`);
    if (i === bestIdx) return clamp(core.accuracy + ranged(h, 0, 5), core.accuracy, 99);
    const drop = isSpecialist ? ranged(h, 10, 20) : ranged(h, 3, 12);
    return clamp(core.accuracy - drop, 50, 99);
  });

  // Problem distribution across domains
  const shares = isSpecialist ? [0.70, 0.18, 0.12] : [0.38, 0.38, 0.24];
  const orderedShares = DOMAIN_KEYS.map((_, i) => {
    if (i === bestIdx) return shares[0];
    if (i === (bestIdx + 1) % 3) return shares[1];
    return shares[2];
  });

  const domains: Specialization["domains"] = {
    codeReasoning: {
      accuracy: domainAccuracies[0],
      problemsSolved: Math.floor(core.verifications * orderedShares[0]),
      avgPeerScore: parseFloat(
        clamp((domainAccuracies[0] + ranged(fh(address, "ps0"), -3, 5)) / 100, 0, 1).toFixed(2)
      ),
      expertise: getExpertise(domainAccuracies[0]),
    },
    mathReasoning: {
      accuracy: domainAccuracies[1],
      problemsSolved: Math.floor(core.verifications * orderedShares[1]),
      avgPeerScore: parseFloat(
        clamp((domainAccuracies[1] + ranged(fh(address, "ps1"), -3, 5)) / 100, 0, 1).toFixed(2)
      ),
      expertise: getExpertise(domainAccuracies[1]),
    },
    logicReasoning: {
      accuracy: domainAccuracies[2],
      problemsSolved: Math.floor(core.verifications * orderedShares[2]),
      avgPeerScore: parseFloat(
        clamp((domainAccuracies[2] + ranged(fh(address, "ps2"), -3, 5)) / 100, 0, 1).toFixed(2)
      ),
      expertise: getExpertise(domainAccuracies[2]),
    },
  };

  const specialization: Specialization = {
    domains,
    bestDomain: bestDomainKey,
    languages: LANGUAGE_SETS[fh(address, "lang") % LANGUAGE_SETS.length],
  };

  // Social graph
  const numPartners = ranged(fh(address, "np"), 3, 5);
  const frequentPartners: Collaborator[] = [];
  const baseCollabs = ranged(fh(address, "bc"), 30, 50);

  for (let i = 0; i < numPartners; i++) {
    const h = fh(address, `p${i}`);
    const collabs = Math.max(8, baseCollabs - ranged(h, 5, 12) * i);
    const domIdx = (bestIdx + (i % 2)) % 3;
    frequentPartners.push({
      agentAddress: derivedAddress(address, i),
      collaborations: collabs,
      avgScore: parseFloat(
        clamp((core.accuracy - ranged(h, 0, 8)) / 100, 0.5, 1).toFixed(2)
      ),
      primaryDomain: DOMAIN_KEYS[domIdx],
    });
  }

  const socialGraph: SocialGraph = {
    collaboratorsCount: ranged(fh(address, "tc"), 15, 45),
    frequentPartners,
    endorsementCount: ranged(fh(address, "end"), 20, 65),
    networkCentrality: parseFloat((ranged(fh(address, "cent"), 45, 85) / 100).toFixed(2)),
    averageRating: parseFloat((4.0 + ranged(fh(address, "rat"), 0, 9) / 10).toFixed(1)),
    ratingCount: ranged(fh(address, "rc"), 80, 250),
  };

  // Reliability
  const uptimeBase = clamp(90 + Math.floor(core.accuracy / 20), 88, 99);
  const uptime = parseFloat(
    (uptimeBase - ranged(fh(address, "up"), 0, 4) * 0.5).toFixed(1)
  );
  const totalRounds =
    Math.floor(core.verifications * 1.04) + ranged(fh(address, "tr"), 0, 15);
  const failedRounds = Math.floor(totalRounds * (1 - uptime / 100));

  const reliability: ReliabilityMetrics = {
    uptime,
    failedRounds,
    avgResponseTime: parseFloat(
      (1.5 + ranged(fh(address, "rt"), 0, 25) / 10).toFixed(1)
    ),
    consistencyScore: parseFloat(
      (0.80 + ranged(fh(address, "cs"), 0, 15) / 100).toFixed(2)
    ),
  };

  // Agent history
  const now = Math.floor(Date.now() / 1000);
  const daysActive = Math.max(1, Math.floor((now - core.joinedAt) / 86400));
  const consecutiveDaysActive = clamp(
    daysActive - ranged(fh(address, "streak"), 0, Math.floor(daysActive * 0.15)),
    1,
    daysActive
  );

  const nodeNum = ranged(fh(address, "nn"), 100, 999);
  const nodeType = NODE_TYPES[fh(address, "nt") % NODE_TYPES.length];

  const history: AgentHistory = {
    totalRounds,
    totalEarnings: parseFloat(
      (core.verifications * (0.40 + ranged(fh(address, "earn"), 0, 20) / 100)).toFixed(1)
    ),
    activityVelocity: parseFloat((core.verifications / daysActive).toFixed(1)),
    consecutiveDaysActive,
    nodeId: `agent-${nodeType.toLowerCase()}-${String(nodeNum).padStart(3, "0")}`,
    nodeName: `Agent ${nodeType} ${nodeNum}`,
  };

  // Activity timeline — monthly buckets, up to 6 months back
  const numMonths = Math.min(Math.max(1, Math.ceil(daysActive / 30)), 6);
  const activityTimeline: MonthActivity[] = [];

  for (let i = numMonths - 1; i >= 0; i--) {
    const monthDate = new Date((now - i * 30 * 24 * 3600) * 1000);
    const label = monthDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const h = fh(address, `m${i}`);
    const base = Math.floor(core.verifications / numMonths);
    const variation = ranged(h, -Math.floor(base * 0.3), Math.floor(base * 0.3));
    // Earlier months have slightly lower accuracy (shows improvement trend)
    const monthAccuracy = clamp(
      core.accuracy - i * ranged(fh(address, `ma${i}`), 0, 2),
      core.accuracy - 10,
      core.accuracy + 2
    );
    activityTimeline.push({
      month: label,
      solved: Math.max(5, base + variation),
      accuracy: monthAccuracy,
    });
  }

  return {
    consistency,
    trend,
    specialization,
    socialGraph,
    reliability,
    history,
    activityTimeline,
  };
}

// ── Deterministic preview state ──────────────────────────────────────────────
// These ensure the grid tiles and the profile page always agree on UP / claimed
// / synced status for any given address, with no runtime randomness.

/** ~80 % of preview agents have a Universal Profile deployed. */
export function previewHasUP(address: string): boolean {
  return fh(address, "up_exists") % 10 >= 2;
}

/** Stable fake UP address derived from agent address (same input → same output). */
export function previewUpAddress(address: string): string | null {
  if (!previewHasUP(address)) return null;
  const parts = [
    fh(address, "upa").toString(16).padStart(8, "0"),
    fh(address, "upb").toString(16).padStart(8, "0"),
    fh(address, "upc").toString(16).padStart(8, "0"),
    fh(address, "upd").toString(16).padStart(8, "0"),
    fh(address, "upe").toString(16).padStart(8, "0"),
  ];
  return "0x" + parts.join("").slice(0, 40);
}

/** Stable fake KM address (only non-null when UP exists). */
export function previewKmAddress(address: string): string | null {
  if (!previewHasUP(address)) return null;
  const parts = [
    fh(address, "kma").toString(16).padStart(8, "0"),
    fh(address, "kmb").toString(16).padStart(8, "0"),
    fh(address, "kmc").toString(16).padStart(8, "0"),
    fh(address, "kmd").toString(16).padStart(8, "0"),
    fh(address, "kme").toString(16).padStart(8, "0"),
  ];
  return "0x" + parts.join("").slice(0, 40);
}

/** ~66 % of agents who have a UP have also claimed ownership. */
export function previewClaimed(address: string): boolean {
  if (!previewHasUP(address)) return false;
  return fh(address, "claimed") % 3 !== 2;
}

/** ~33 % of agents have been synced to Ethereum Sepolia. */
export function previewSynced(address: string): boolean {
  return fh(address, "synced") % 3 === 0;
}
