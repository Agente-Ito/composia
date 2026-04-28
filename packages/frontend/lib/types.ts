export interface DomainStats {
  accuracy: number;
  problemsSolved: number;
  avgPeerScore: number;
  expertise: "High" | "Medium" | "Low";
}

export interface Specialization {
  domains: {
    codeReasoning: DomainStats;
    mathReasoning: DomainStats;
    logicReasoning: DomainStats;
  };
  bestDomain: "codeReasoning" | "mathReasoning" | "logicReasoning";
  languages: string[];
}

export interface Collaborator {
  agentAddress: string;
  collaborations: number;
  avgScore: number;
  primaryDomain: "codeReasoning" | "mathReasoning" | "logicReasoning";
}

export interface SocialGraph {
  collaboratorsCount: number;
  frequentPartners: Collaborator[];
  endorsementCount: number;
  networkCentrality: number;
  averageRating: number;
  ratingCount: number;
}

export interface ReliabilityMetrics {
  uptime: number;
  failedRounds: number;
  avgResponseTime: number;
  consistencyScore: number;
}

export interface AgentHistory {
  totalRounds: number;
  totalEarnings: number;
  activityVelocity: number;
  consecutiveDaysActive: number;
  nodeId: string;
  nodeName: string;
}

export interface MonthActivity {
  month: string;
  solved: number;
  accuracy: number;
}

export interface AgentReputation {
  // Core (real on-chain data)
  accuracy: number;
  verifications: number;
  correct: number;
  lastUpdated: number;
  joinedAt: number;
  synced: boolean;
  // Extended (mock → real Gensyn post-hackathon)
  consistency: "stable" | "rising" | "declining";
  trend: string;
  specialization: Specialization;
  socialGraph: SocialGraph;
  reliability: ReliabilityMetrics;
  history: AgentHistory;
  activityTimeline: MonthActivity[];
  // Composia multi-dimensional score
  composiaScore?: import("./score").ComposiaScore;
}

export interface AgentProfile {
  agentAddress: string;
  upAddress: string | null;
  kmAddress: string | null;
  reputation: AgentReputation | null;
  syncedChains: ChainStatus[];
}

export interface ChainStatus {
  name: string;
  chainId: number;
  accuracy: number | null;
  verifications: number | null;
  receivedAt: number | null;
  synced: boolean;
}

export interface SimulateRequest {
  agent: string;
  accuracy: number;
  verifications: number;
}

export interface SimulateResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  preview?: boolean;
}
