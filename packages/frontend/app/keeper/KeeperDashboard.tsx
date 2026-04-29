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

// Matches the actual /api/keeperhub/auto-config response shape
interface ChainConfig {
  id: string;
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
}

interface WorkflowConfig {
  id: string;
  name: string;
  trigger: {
    contract: string;   // e.g. "MockGensyn"
    event: string;      // e.g. "VerificationCompleted"
    chain: string;      // chain id string e.g. "lukso-testnet"
  };
  condition?: {
    url: string;
    method?: string;
    passWhen: string;
  };
  action: {
    url: string;
    method?: string;
    body?: Record<string, unknown>;
    authHeader?: boolean;
  };
}

interface AutoConfig {
  chains: ChainConfig[];
  contracts: {
    "lukso-testnet":    { composiaRegistry: string; mockGensyn: string };
    "ethereum-sepolia": { syncerContract: string };
  };
  endpoints: Record<string, string>;
  workflows: WorkflowConfig[];
}

const LUKSO_EXPLORER = "https://explorer.execution.testnet.lukso.network";

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
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

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

// Resolve a contract address from the config given a workflow's trigger
function resolveContractAddr(wf: WorkflowConfig, cfg: AutoConfig): string {
  const lukso = cfg.contracts["lukso-testnet"];
  if (wf.trigger.contract === "MockGensyn")       return lukso?.mockGensyn ?? "";
  if (wf.trigger.contract === "ComposiaRegistry") return lukso?.composiaRegistry ?? "";
  return "";
}

// Static fallback — used before auto-config loads
const STATIC_WORKFLOWS: WorkflowConfig[] = [
  {
    id: "gensyn-listener-lukso",
    name: "Gensyn Listener — LUKSO Testnet",
    trigger: { contract: "MockGensyn", event: "VerificationCompleted", chain: "lukso-testnet" },
    condition: { url: "/api/status", method: "GET", passWhen: "ok === true" },
    action:    { url: "/api/keeper", method: "POST", body: { action: "run" }, authHeader: true },
  },
  {
    id: "cross-chain-sync",
    name: "Cross-Chain Sync — LUKSO → Sepolia",
    trigger: { contract: "ComposiaRegistry", event: "ReputationUpdated", chain: "lukso-testnet" },
    action:  { url: "/api/sync", method: "POST", authHeader: true },
  },
];

export default function KeeperDashboard() {
  const [data, setData]           = useState<HistoryData | null>(null);
  const [running, setRunning]     = useState(false);
  const [runMsg, setRunMsg]       = useState<string | null>(null);
  const [autoConfig, setAutoConfig] = useState<AutoConfig | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/keeper/history", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 15_000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  useEffect(() => {
    fetch("/api/keeperhub/auto-config")
      .then(r => r.json())
      .then(setAutoConfig)
      .catch(() => {});
  }, []);

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

  const stats    = data?.stats;
  const entries  = data?.entries ?? [];
  const workflows = autoConfig?.workflows ?? STATIC_WORKFLOWS;

  return (
    <div className="space-y-8">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total runs", value: stats?.total   ?? "—", color: "text-[#c8e6ea]" },
          { label: "Created",    value: stats?.created ?? "—", color: "text-[#00FF88]" },
          { label: "Updated",    value: stats?.updated ?? "—", color: "text-[#00D4FF]" },
          { label: "Failed",     value: stats?.failed  ?? "—", color: "text-[#FF4060]" },
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
        <h2 className="text-sm font-semibold text-[#4a6670] uppercase tracking-widest mb-3">
          Active Workflows
        </h2>
        <div className="space-y-3">
          {workflows.map((wf) => {
            const isExpanded   = expanded === wf.id;
            const contractAddr = autoConfig ? resolveContractAddr(wf, autoConfig) : "";
            const chain        = autoConfig?.chains.find(c => c.id === wf.trigger.chain);
            const explorerBase = chain?.explorer ?? LUKSO_EXPLORER;
            const actionPath   = wf.action.url.replace(/^https?:\/\/[^/]+/, "");
            const condPath     = wf.condition?.url.replace(/^https?:\/\/[^/]+/, "") ?? "";

            return (
              <div key={wf.id} className="bg-[#080b12] border border-[#0d1a24] rounded-xl overflow-hidden">
                {/* Clickable header */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : wf.id)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[#c8e6ea] font-medium text-sm">{wf.name}</span>
                    <div className="text-xs text-[#4a6670] mt-0.5 truncate">
                      {wf.trigger.contract}.{wf.trigger.event}
                      {" → "}
                      <span className="font-mono">{actionPath}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00FF88]/10 text-[#00FF88] font-mono">
                      ACTIVE
                    </span>
                    <span className="text-[#4a6670] text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded pipeline */}
                {isExpanded && (
                  <div className="px-5 pb-6 space-y-5 border-t border-[#0d1a24]">
                    {/* Pipeline visual */}
                    <div className="pt-4">
                      <div className="text-[10px] text-[#4a6670] uppercase tracking-wide mb-3">Pipeline</div>
                      <div className="flex items-start gap-2 overflow-x-auto pb-1">
                        {/* Trigger box */}
                        <PipelineBox label="Trigger" color="cyan">
                          <div className="font-mono font-medium">{wf.trigger.contract}</div>
                          <div className="text-[#00D4FF]">.{wf.trigger.event}</div>
                          <div className="text-[#4a6670] mt-0.5">{chain?.name ?? wf.trigger.chain}</div>
                          {contractAddr ? (
                            <a
                              href={`${explorerBase}/address/${contractAddr}`}
                              target="_blank" rel="noreferrer"
                              className="text-[#4a6670] hover:text-[#00D4FF] transition-colors font-mono"
                            >
                              {truncateAddr(contractAddr)} ↗
                            </a>
                          ) : (
                            <span className="text-[#2a3a44]">address pending</span>
                          )}
                        </PipelineBox>

                        <Arrow />

                        {/* Condition box (optional) */}
                        {wf.condition && (
                          <>
                            <PipelineBox label="Condition" color="yellow">
                              <div className="text-[#FFC033] font-medium">Health Check</div>
                              <div className="font-mono text-[#4a6670]">
                                {wf.condition.method ?? "GET"} {condPath}
                              </div>
                              <div className="text-[#4a6670]">{wf.condition.passWhen}</div>
                            </PipelineBox>
                            <Arrow />
                          </>
                        )}

                        {/* Action box */}
                        <PipelineBox label="Action" color="green">
                          <div className="text-[#00FF88] font-medium">
                            HTTP {wf.action.method ?? "POST"}
                          </div>
                          <div className="font-mono text-[#4a6670]">{actionPath}</div>
                          {wf.action.body && (
                            <div className="font-mono text-[#4a6670]">
                              {JSON.stringify(wf.action.body)}
                            </div>
                          )}
                          {wf.action.authHeader && (
                            <div className="text-[#605CFF]">Auth: Bearer ✓</div>
                          )}
                        </PipelineBox>
                      </div>
                    </div>

                    {/* Contract address — full */}
                    {contractAddr && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-[#4a6670] uppercase tracking-wide">Contract</div>
                        <a
                          href={`${explorerBase}/address/${contractAddr}`}
                          target="_blank" rel="noreferrer"
                          className="font-mono text-xs text-[#c8e6ea] hover:text-[#00D4FF] transition-colors break-all"
                        >
                          {contractAddr} ↗
                        </a>
                      </div>
                    )}

                    {/* Event signature */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-[#4a6670] uppercase tracking-wide">Event</div>
                      <div className="font-mono text-[10px] text-[#c8e6ea] bg-[#050508] border border-[#0d1a24] rounded px-3 py-2">
                        {wf.trigger.event}(address indexed agent, …)
                      </div>
                    </div>

                    {/* Chain info */}
                    <div className="flex flex-wrap gap-4 text-[10px] text-[#4a6670]">
                      <span>Chain: <span className="text-[#c8e6ea]">{chain?.name ?? wf.trigger.chain}</span></span>
                      {chain && (
                        <span>Chain ID: <span className="font-mono text-[#c8e6ea]">{chain.chainId}</span></span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Execution timeline ── */}
      <section>
        <h2 className="text-sm font-semibold text-[#4a6670] uppercase tracking-widest mb-3">
          Execution History
        </h2>
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
                    target="_blank" rel="noreferrer"
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

// ── Inline subcomponents ───────────────────────────────────────────────────────

function Arrow() {
  return <div className="text-[#2a3a44] mt-8 shrink-0 text-base select-none">→</div>;
}

function PipelineBox({
  label, color, children,
}: {
  label: string;
  color: "cyan" | "yellow" | "green";
  children: React.ReactNode;
}) {
  const labelColor = color === "cyan" ? "text-[#00D4FF]"
    : color === "yellow" ? "text-[#FFC033]"
    : "text-[#00FF88]";
  return (
    <div className="shrink-0 min-w-[130px] max-w-[160px]">
      <div className={`text-[9px] uppercase tracking-wide text-center mb-1 ${labelColor}`}>{label}</div>
      <div className="bg-[#050508] border border-[#0d1a24] rounded-lg px-3 py-2.5 space-y-0.5 text-[9px] text-center">
        {children}
      </div>
    </div>
  );
}
