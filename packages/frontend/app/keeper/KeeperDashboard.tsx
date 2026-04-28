"use client";

import { useState, useEffect, useCallback } from "react";
import { KeeperLogEntry } from "@/lib/keeper-log";
import { runKeeperNow } from "./actions";

interface HistoryData {
  entries: KeeperLogEntry[];
  stats: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    lastRun: number | null;
  };
}

const LUKSO_EXPLORER = "https://explorer.execution.testnet.lukso.network";

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusColor(s: KeeperLogEntry["status"]) {
  if (s === "created") return "text-[#00FF88]";
  if (s === "updated") return "text-[#00D4FF]";
  return "text-[#FF4060]";
}
function statusLabel(s: KeeperLogEntry["status"]) {
  if (s === "created") return "✦ Created";
  if (s === "updated") return "↑ Updated";
  return "✕ Failed";
}

export default function KeeperDashboard() {
  const [data, setData]     = useState<HistoryData | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/keeper/history", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 15_000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  async function handleRun() {
    setRunning(true);
    setRunMsg(null);
    try {
      const result = await runKeeperNow();
      setRunMsg(
        result.ok
          ? `Run complete — ${result.processed} agent(s) processed.`
          : `Run failed: ${result.error ?? "unknown error"}`
      );
      await fetchHistory();
    } finally {
      setRunning(false);
    }
  }

  const stats = data?.stats;
  const entries = data?.entries ?? [];

  return (
    <div className="space-y-8">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total runs",  value: stats?.total   ?? "—", color: "text-[#c8e6ea]" },
          { label: "Created",     value: stats?.created ?? "—", color: "text-[#00FF88]" },
          { label: "Updated",     value: stats?.updated ?? "—", color: "text-[#00D4FF]" },
          { label: "Failed",      value: stats?.failed  ?? "—", color: "text-[#FF4060]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#080b12] border border-[#0d1a24] rounded-xl p-4 text-center">
            <div className={`text-2xl font-sora font-bold ${color}`}>{value}</div>
            <div className="text-xs text-[#4a6670] mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Run Now ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleRun}
          disabled={running}
          className="px-6 py-2.5 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/40 text-[#00D4FF] font-semibold text-sm hover:bg-[#00D4FF]/20 disabled:opacity-50 transition"
        >
          {running ? "Running…" : "▶ Run Now"}
        </button>
        {runMsg && (
          <span className={`text-sm ${runMsg.startsWith("Run complete") ? "text-[#00FF88]" : "text-[#FF4060]"}`}>
            {runMsg}
          </span>
        )}
        {stats?.lastRun && (
          <span className="text-xs text-[#4a6670] ml-auto">
            Last run: {relativeTime(stats.lastRun)}
          </span>
        )}
      </div>

      {/* ── Active Workflows ── */}
      <section>
        <h2 className="text-sm font-semibold text-[#4a6670] uppercase tracking-widest mb-3">Active Workflows</h2>
        <div className="space-y-3">
          {[
            {
              id: "gensyn-listener-lukso",
              name: "Gensyn Listener — LUKSO Testnet",
              trigger: "VerificationCompleted event",
              action: "POST /api/keeper",
            },
            {
              id: "cross-chain-sync",
              name: "Cross-Chain Sync — LUKSO → Sepolia",
              trigger: "ReputationUpdated event",
              action: "POST /api/sync",
            },
          ].map((wf) => (
            <div
              key={wf.id}
              className="bg-[#080b12] border border-[#0d1a24] rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2"
            >
              <div className="flex-1">
                <span className="text-[#c8e6ea] font-medium text-sm">{wf.name}</span>
                <div className="text-xs text-[#4a6670] mt-0.5">
                  Trigger: {wf.trigger} → {wf.action}
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00FF88]/10 text-[#00FF88] font-mono w-fit">
                ACTIVE
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Execution timeline ── */}
      <section>
        <h2 className="text-sm font-semibold text-[#4a6670] uppercase tracking-widest mb-3">Execution History</h2>
        {entries.length === 0 ? (
          <div className="text-[#4a6670] text-sm py-8 text-center border border-dashed border-[#0d1a24] rounded-xl">
            No executions recorded yet. History populates after the first keeper run.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="bg-[#080b12] border border-[#0d1a24] rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm"
              >
                <span className={`font-semibold w-24 shrink-0 ${statusColor(e.status)}`}>
                  {statusLabel(e.status)}
                </span>
                <span className="font-mono text-[#c8e6ea] truncate flex-1 text-xs">
                  {e.agent}
                </span>
                {e.upAddress && (
                  <a
                    href={`${LUKSO_EXPLORER}/address/${e.upAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#00D4FF] text-xs hover:underline"
                  >
                    UP ↗
                  </a>
                )}
                {e.error && (
                  <span className="text-[#FF4060] text-xs truncate max-w-xs" title={e.error}>
                    {e.error}
                  </span>
                )}
                <span className="text-[#4a6670] text-xs shrink-0 ml-auto">
                  {relativeTime(e.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
