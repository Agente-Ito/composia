/**
 * In-memory keeper execution log (singleton, cap 100 entries).
 * Survives the lifetime of the Next.js server process.
 */

export type KeeperLogStatus = "created" | "updated" | "failed";
export type KeeperLogStep   = "create-up" | "register-ens" | "update-reputation";
export type KeeperLogChain  = "lukso" | "sepolia";

export interface KeeperLogEntry {
  id: string;
  timestamp: number;        // unix seconds
  action: "scan" | "run";
  step?: KeeperLogStep;     // which atomic workflow step
  chain?: KeeperLogChain;   // which chain the tx landed on
  agent: string;
  status: KeeperLogStatus;
  upAddress?: string;
  kmAddress?: string;
  ensName?: string;         // "{hex8}.composia.eth" when step="register-ens"
  txHash?: string;          // tx hash of the primary transaction
  error?: string;
}

const MAX_ENTRIES = 100;

// Module-level singleton — shared across all requests in the same server process
const entries: KeeperLogEntry[] = [];
let seq = 0;

export const keeperLog = {
  append(entry: Omit<KeeperLogEntry, "id">): KeeperLogEntry {
    const full: KeeperLogEntry = { id: `kl-${++seq}`, ...entry };
    entries.unshift(full); // newest first
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    return full;
  },

  getRecent(n = 50): KeeperLogEntry[] {
    return entries.slice(0, n);
  },

  stats(): { total: number; created: number; updated: number; failed: number; lastRun: number | null } {
    const created = entries.filter((e) => e.status === "created").length;
    const updated = entries.filter((e) => e.status === "updated").length;
    const failed  = entries.filter((e) => e.status === "failed").length;
    const lastRun = entries.length > 0 ? entries[0].timestamp : null;
    return { total: entries.length, created, updated, failed, lastRun };
  },

  /**
   * Groups entries by agent address, keeping the most-recent entry per (agent, step).
   * Returns a map of agentAddress → { step → entry }.
   */
  byAgent(): Map<string, Partial<Record<KeeperLogStep, KeeperLogEntry>>> {
    const map = new Map<string, Partial<Record<KeeperLogStep, KeeperLogEntry>>>();
    // entries are newest-first, so iterating forward gives us latest-wins per step
    for (const e of entries) {
      if (!e.step) continue;
      const key = e.agent.toLowerCase();
      if (!map.has(key)) map.set(key, {});
      const agentSteps = map.get(key)!;
      if (!agentSteps[e.step]) agentSteps[e.step] = e; // keep first (newest) seen per step
    }
    return map;
  },
};
