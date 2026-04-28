/**
 * In-memory keeper execution log (singleton, cap 100 entries).
 * Survives the lifetime of the Next.js server process.
 */

export type KeeperLogStatus = "created" | "updated" | "failed";

export interface KeeperLogEntry {
  id: string;
  timestamp: number;      // unix seconds
  action: "scan" | "run";
  agent: string;
  status: KeeperLogStatus;
  upAddress?: string;
  kmAddress?: string;
  txHash?: string;        // creation/update tx hash if available
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
};
