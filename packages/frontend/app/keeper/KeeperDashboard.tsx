"use client";

import { useState, useEffect, useCallback } from "react";
import { KeeperLogEntry, KeeperLogStep } from "@/lib/keeper-log";

// ── Types ─────────────────────────────────────────────────────────────────────
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
  step?: number;
  description?: string;
  trigger: {
    contract: string;
    event: string;
    chain: string;
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
  outputChain?: string;
  emitsEvents?: string[];
}

interface AutoConfig {
  chains: ChainConfig[];
  contracts: {
    "lukso-testnet":    { composiaRegistry: string; mockGensyn: string };
    "ethereum-sepolia": { syncerContract: string; ensRegistrar?: string; reputationState?: string };
  };
  endpoints: Record<string, string>;
  workflows: WorkflowConfig[];
}

// ── Step metadata ─────────────────────────────────────────────────────────────
const STEP_META: Record<KeeperLogStep, { label: string; chain: "LUKSO" | "SEPOLIA" }> = {
  "create-up":         { label: "Create UP",    chain: "LUKSO"   },
  "register-ens":      { label: "Register ENS", chain: "SEPOLIA" },
  "update-reputation": { label: "Update Rep",   chain: "SEPOLIA" },
};
const STEP_ORDER: KeeperLogStep[] = ["create-up", "register-ens", "update-reputation"];

const LUKSO_EXPLORER   = "https://explorer.execution.testnet.lukso.network";
const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
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

function resolveContractAddr(wf: WorkflowConfig, cfg: AutoConfig): string {
  const lukso = cfg.contracts["lukso-testnet"];
  if (wf.trigger.contract === "MockGensyn")       return lukso?.mockGensyn ?? "";
  if (wf.trigger.contract === "ComposiaRegistry") return lukso?.composiaRegistry ?? "";
  return "";
}

/** Build per-agent pipeline map from flat log entries */
function buildPipelines(
  entries: KeeperLogEntry[],
): Map<string, Partial<Record<KeeperLogStep, KeeperLogEntry>>> {
  const map = new Map<string, Partial<Record<KeeperLogStep, KeeperLogEntry>>>();
  for (const e of entries) {
    if (!e.step) continue;
    const key = e.agent.toLowerCase();
    if (!map.has(key)) map.set(key, {});
    const agentSteps = map.get(key)!;
    if (!agentSteps[e.step]) agentSteps[e.step] = e; // newest-first: keep first seen
  }
  return map;
}

// ── Static fallback workflows ─────────────────────────────────────────────────
const STATIC_WORKFLOWS: WorkflowConfig[] = [
  {
    id: "step-1-create-up", name: "Step 1 — Create Universal Profile", step: 1,
    description: "Deploy UP + LSP6 KeyManager on LUKSO and register in ComposiaRegistry.",
    trigger: { contract: "MockGensyn", event: "VerificationCompleted", chain: "lukso-testnet" },
    condition: { url: "/api/status", method: "GET", passWhen: "ok === true" },
    action: { url: "/api/keeper/create-up", method: "POST",
      body: { agent: "{{event.agent}}", accuracy: "{{event.accuracy}}", verifications: "{{event.verifications}}" },
      authHeader: true },
    outputChain: "lukso-testnet",
    emitsEvents: ["ComposiaRegistry.ProfileRegistered", "ComposiaRegistry.ReputationUpdated"],
  },
  {
    id: "step-2-register-ens", name: "Step 2 — Register ENS Subdomain", step: 2,
    description: "Create {hex8}.composia.eth on Sepolia and seed ReputationState.",
    trigger: { contract: "ComposiaRegistry", event: "ProfileRegistered", chain: "lukso-testnet" },
    action: { url: "/api/keeper/register-ens", method: "POST",
      body: { agent: "{{event.agent}}", upAddress: "{{event.upAddress}}" }, authHeader: true },
    outputChain: "ethereum-sepolia",
    emitsEvents: [],
  },
  {
    id: "step-3-update-reputation", name: "Step 3 — Update Reputation & Sync", step: 3,
    description: "Update ReputationState on Sepolia and sync to SyncerContract.",
    trigger: { contract: "ComposiaRegistry", event: "ReputationUpdated", chain: "lukso-testnet" },
    action: { url: "/api/keeper/update-reputation", method: "POST",
      body: { agent: "{{event.agent}}", accuracy: "{{event.accuracy}}", verifications: "{{event.verifications}}" },
      authHeader: true },
    outputChain: "ethereum-sepolia",
    emitsEvents: [],
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function KeeperDashboard() {
  const [data, setData]                 = useState<HistoryData | null>(null);
  const [running, setRunning]           = useState(false);
  const [runMsg, setRunMsg]             = useState<string | null>(null);
  const [autoConfig, setAutoConfig]     = useState<AutoConfig | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [view, setView]                 = useState<"pipelines" | "history">("pipelines");
  const [showSimulate, setShowSimulate] = useState(false);

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
      const apiKey = process.env.NEXT_PUBLIC_COMPOSIA_API_KEY;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch("/api/keeper", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "run" }),
        cache: "no-store",
      });
      const data = await res.json();
      const processed = (data.results as { action: string }[] ?? [])
        .filter(r => r.action === "created" || r.action === "updated").length;
      setRunMsg(
        data.ok
          ? `Run complete — ${processed} agent(s) processed.`
          : `Run failed: ${data.error ?? "unknown error"}`
      );
      await fetchHistory();
    } catch (err: unknown) {
      setRunMsg(`Run failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setRunning(false);
    }
  }

  const stats     = data?.stats;
  const entries   = data?.entries ?? [];
  const workflows = autoConfig?.workflows ?? STATIC_WORKFLOWS;
  const pipelines = buildPipelines(entries);

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

      {/* ── Controls row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRun}
          disabled={running}
          className="px-6 py-2.5 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/40 text-[#00D4FF] font-semibold text-sm hover:bg-[#00D4FF]/20 disabled:opacity-50 transition"
        >
          {running ? "Running…" : "▶ Run Now"}
        </button>

        <button
          onClick={() => setShowSimulate(true)}
          className="px-6 py-2.5 rounded-xl bg-[#605CFF]/10 border border-[#605CFF]/40 text-[#605CFF] font-semibold text-sm hover:bg-[#605CFF]/20 transition"
        >
          ⚡ Simulate Event
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
            const isExp        = expanded === wf.id;
            const contractAddr = autoConfig ? resolveContractAddr(wf, autoConfig) : "";
            const chain        = autoConfig?.chains.find(c => c.id === wf.trigger.chain);
            const explorerBase = chain?.explorer ?? LUKSO_EXPLORER;
            const actionPath   = wf.action.url.replace(/^https?:\/\/[^/]+/, "");
            const condPath     = wf.condition?.url.replace(/^https?:\/\/[^/]+/, "") ?? "";
            const stepTotal    = workflows.length;

            return (
              <div key={wf.id} className="bg-[#080b12] border border-[#0d1a24] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExp ? null : wf.id)}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition"
                >
                  {wf.step && (
                    <span className="shrink-0 text-[9px] font-mono px-2 py-0.5 rounded border border-[#605CFF]/30 text-[#605CFF]">
                      {wf.step}/{stepTotal}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[#c8e6ea] font-medium text-sm">{wf.name}</span>
                    <div className="text-xs text-[#4a6670] mt-0.5 truncate">
                      {wf.trigger.contract}.{wf.trigger.event}
                      {" → "}
                      <span className="font-mono">{actionPath}</span>
                    </div>
                    {wf.description && (
                      <div className="text-[10px] text-[#4a6670]/70 mt-0.5 truncate">{wf.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00FF88]/10 text-[#00FF88] font-mono">
                      ACTIVE
                    </span>
                    <span className="text-[#4a6670] text-xs">{isExp ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isExp && (
                  <div className="px-5 pb-6 space-y-5 border-t border-[#0d1a24]">
                    <div className="pt-4">
                      <div className="text-[10px] text-[#4a6670] uppercase tracking-wide mb-3">Pipeline</div>
                      <div className="flex items-start gap-2 overflow-x-auto pb-1">
                        <PipelineBox label="Trigger" color="cyan">
                          <div className="font-mono font-medium">{wf.trigger.contract}</div>
                          <div className="text-[#00D4FF]">.{wf.trigger.event}</div>
                          <div className="text-[#4a6670] mt-0.5">{chain?.name ?? wf.trigger.chain}</div>
                          {contractAddr ? (
                            <a href={`${explorerBase}/address/${contractAddr}`} target="_blank" rel="noreferrer"
                              className="text-[#4a6670] hover:text-[#00D4FF] transition-colors font-mono">
                              {truncateAddr(contractAddr)} ↗
                            </a>
                          ) : <span className="text-[#2a3a44]">address pending</span>}
                        </PipelineBox>

                        <Arrow />

                        {wf.condition && (
                          <>
                            <PipelineBox label="Condition" color="yellow">
                              <div className="text-[#FFC033] font-medium">Health Check</div>
                              <div className="font-mono text-[#4a6670]">{wf.condition.method ?? "GET"} {condPath}</div>
                              <div className="text-[#4a6670]">{wf.condition.passWhen}</div>
                            </PipelineBox>
                            <Arrow />
                          </>
                        )}

                        <PipelineBox label="Action" color="green">
                          <div className="text-[#00FF88] font-medium">HTTP {wf.action.method ?? "POST"}</div>
                          <div className="font-mono text-[#4a6670]">{actionPath}</div>
                          {wf.action.body && (
                            <div className="font-mono text-[#4a6670] break-all">
                              {JSON.stringify(wf.action.body)}
                            </div>
                          )}
                          {wf.action.authHeader && <div className="text-[#605CFF]">Auth: Bearer ✓</div>}
                        </PipelineBox>

                        {(wf.emitsEvents && wf.emitsEvents.length > 0) && (
                          <>
                            <Arrow />
                            <PipelineBox label="Emits" color="purple">
                              {wf.emitsEvents.map(e => (
                                <div key={e} className="text-[#605CFF] font-mono">{e.split(".")[1]}</div>
                              ))}
                              <div className="text-[#4a6670] mt-0.5">→ next step</div>
                            </PipelineBox>
                          </>
                        )}
                      </div>
                    </div>

                    {contractAddr && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-[#4a6670] uppercase tracking-wide">Contract</div>
                        <a href={`${explorerBase}/address/${contractAddr}`} target="_blank" rel="noreferrer"
                          className="font-mono text-xs text-[#c8e6ea] hover:text-[#00D4FF] transition-colors break-all">
                          {contractAddr} ↗
                        </a>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="text-[10px] text-[#4a6670] uppercase tracking-wide">Event Signature</div>
                      <div className="font-mono text-[10px] text-[#c8e6ea] bg-[#050508] border border-[#0d1a24] rounded px-3 py-2">
                        {wf.trigger.event}(address indexed agent, …)
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-[10px] text-[#4a6670]">
                      <span>Chain: <span className="text-[#c8e6ea]">{chain?.name ?? wf.trigger.chain}</span></span>
                      {chain && <span>Chain ID: <span className="font-mono text-[#c8e6ea]">{chain.chainId}</span></span>}
                      {wf.outputChain && (
                        <span>Output: <span className="text-[#c8e6ea]">
                          {autoConfig?.chains.find(c => c.id === wf.outputChain)?.name ?? wf.outputChain}
                        </span></span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Execution: Pipelines / History ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#4a6670] uppercase tracking-widest">Execution</h2>
          <div className="flex gap-1">
            {(["pipelines", "history"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`text-[10px] px-3 py-1 rounded-lg capitalize transition ${
                  view === v
                    ? "bg-[#0d1a24] text-[#c8e6ea] border border-[#00D4FF]/30"
                    : "text-[#4a6670] hover:text-[#c8e6ea]"
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {view === "pipelines" && (
          pipelines.size === 0 ? (
            <EmptyState text="No pipelines yet. Simulate an event or wait for KeeperHub to trigger the workflow." />
          ) : (
            <div className="space-y-3">
              {Array.from(pipelines.entries()).map(([agent, steps]) => (
                <div key={agent} className="bg-[#080b12] border border-[#0d1a24] rounded-xl p-4">
                  <div className="text-xs text-[#4a6670] font-mono mb-3 flex items-center gap-2">
                    <span className="text-[#c8e6ea]">{truncateAddr(agent)}</span>
                    {steps["register-ens"]?.ensName && (
                      <span className="text-[#605CFF]">{steps["register-ens"].ensName}</span>
                    )}
                    <span className="ml-auto text-[9px]">
                      {relativeTime(
                        Math.max(...STEP_ORDER.map(s => steps[s]?.timestamp ?? 0).filter(Boolean))
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {STEP_ORDER.map((step) => (
                      <StepCell key={step} entry={steps[step]} meta={STEP_META[step]}
                        luksoExplorer={LUKSO_EXPLORER} sepoliaExplorer={SEPOLIA_EXPLORER} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {view === "history" && (
          entries.length === 0 ? (
            <EmptyState text="No executions recorded yet. History populates after the first keeper run." />
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id}
                  className="bg-[#080b12] border border-[#0d1a24] rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                  <span className={`font-semibold w-24 shrink-0 ${statusColor(e.status)}`}>
                    {statusLabel(e.status)}
                  </span>
                  {e.chain && <ChainBadge chain={e.chain === "sepolia" ? "SEPOLIA" : "LUKSO"} />}
                  <span className="font-mono text-[#c8e6ea] truncate flex-1 text-xs">{e.agent}</span>
                  {e.upAddress && (
                    <a href={`${LUKSO_EXPLORER}/address/${e.upAddress}`} target="_blank" rel="noreferrer"
                      className="text-[#00D4FF] text-xs hover:underline">UP ↗</a>
                  )}
                  {e.txHash && (
                    <a href={`${e.chain === "sepolia" ? SEPOLIA_EXPLORER : LUKSO_EXPLORER}/tx/${e.txHash}`}
                      target="_blank" rel="noreferrer"
                      className="text-[#4a6670] text-xs hover:text-[#00D4FF] font-mono">
                      {e.txHash.slice(0, 10)}… ↗
                    </a>
                  )}
                  {e.error && (
                    <span className="text-[#FF4060] text-xs truncate max-w-xs" title={e.error}>{e.error}</span>
                  )}
                  <span className="text-[#4a6670] text-xs shrink-0 ml-auto">{relativeTime(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {showSimulate && (
        <SimulateModal onClose={() => setShowSimulate(false)} onSimulated={fetchHistory} />
      )}
    </div>
  );
}

// ── Inline subcomponents ──────────────────────────────────────────────────────

function Arrow() {
  return <div className="text-[#2a3a44] mt-8 shrink-0 text-base select-none">→</div>;
}

function PipelineBox({
  label, color, children,
}: {
  label: string;
  color: "cyan" | "yellow" | "green" | "purple";
  children: React.ReactNode;
}) {
  const labelColor =
    color === "cyan"   ? "text-[#00D4FF]" :
    color === "yellow" ? "text-[#FFC033]" :
    color === "purple" ? "text-[#605CFF]" :
    "text-[#00FF88]";
  return (
    <div className="shrink-0 min-w-[130px] max-w-[180px]">
      <div className={`text-[9px] uppercase tracking-wide text-center mb-1 ${labelColor}`}>{label}</div>
      <div className="bg-[#050508] border border-[#0d1a24] rounded-lg px-3 py-2.5 space-y-0.5 text-[9px] text-center">
        {children}
      </div>
    </div>
  );
}

function ChainBadge({ chain }: { chain: "LUKSO" | "SEPOLIA" }) {
  const cls = chain === "LUKSO"
    ? "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20"
    : "bg-[#605CFF]/10 text-[#605CFF] border-[#605CFF]/20";
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${cls}`}>{chain}</span>
  );
}

function StepCell({
  entry, meta, luksoExplorer, sepoliaExplorer,
}: {
  entry?: KeeperLogEntry;
  meta: { label: string; chain: "LUKSO" | "SEPOLIA" };
  luksoExplorer: string;
  sepoliaExplorer: string;
}) {
  const explorer = meta.chain === "LUKSO" ? luksoExplorer : sepoliaExplorer;

  if (!entry) {
    return (
      <div className="bg-[#050508] border border-dashed border-[#0d1a24] rounded-lg p-3 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-700 shrink-0" />
          <ChainBadge chain={meta.chain} />
        </div>
        <div className="text-[10px] text-[#4a6670] font-medium">{meta.label}</div>
        <div className="text-[9px] text-[#2a3a44]">Waiting…</div>
      </div>
    );
  }

  const isDone   = entry.status !== "failed";
  const dotColor = isDone
    ? (meta.chain === "LUKSO" ? "bg-[#00D4FF]" : "bg-[#605CFF]")
    : "bg-[#FF4060]";

  return (
    <div className={`bg-[#050508] border rounded-lg p-3 flex flex-col gap-1 ${
      isDone ? "border-[#0d1a24]" : "border-[#FF4060]/20"
    }`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <ChainBadge chain={meta.chain} />
      </div>
      <div className="text-[10px] text-[#c8e6ea] font-medium">{meta.label}</div>
      {entry.upAddress && (
        <a href={`${luksoExplorer}/address/${entry.upAddress}`} target="_blank" rel="noreferrer"
          className="text-[9px] font-mono text-[#4a6670] hover:text-[#00D4FF]">
          {entry.upAddress.slice(0, 10)}… ↗
        </a>
      )}
      {entry.ensName && (
        <div className="text-[9px] font-mono text-[#605CFF]">{entry.ensName}</div>
      )}
      {entry.txHash && (
        <a href={`${explorer}/tx/${entry.txHash}`} target="_blank" rel="noreferrer"
          className="text-[9px] font-mono text-[#4a6670] hover:text-[#00D4FF]">
          tx {entry.txHash.slice(0, 8)}… ↗
        </a>
      )}
      {entry.error && (
        <div className="text-[9px] text-[#FF4060] truncate" title={entry.error}>{entry.error}</div>
      )}
      <div className="text-[9px] text-[#2a3a44] mt-auto">{relativeTime(entry.timestamp)}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-[#4a6670] text-sm py-8 text-center border border-dashed border-[#0d1a24] rounded-xl">
      {text}
    </div>
  );
}

function SimulateModal({
  onClose, onSimulated,
}: {
  onClose: () => void;
  onSimulated: () => void;
}) {
  const [agent, setAgent]         = useState("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const [accuracy, setAccuracy]   = useState(95);
  const [verifs, setVerifs]       = useState(1000);
  const [pending, setPending]     = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; txHash?: string; error?: string } | null>(null);

  async function handleSimulate() {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/keeper/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, accuracy, verifications: verifs }),
      });
      const r = await res.json();
      setResult(r);
      if (r.ok) onSimulated();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#080b12] border border-[#0d1a24] rounded-2xl p-6 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#c8e6ea]">Simulate Gensyn Event</h3>
          <button onClick={onClose} className="text-[#4a6670] hover:text-white text-lg">✕</button>
        </div>

        <p className="text-xs text-[#4a6670]">
          Fires <span className="font-mono text-[#c8e6ea]">MockGensyn.simulate()</span> on LUKSO Testnet.
          KeeperHub detects the event and triggers the 3-step pipeline automatically.
        </p>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] text-[#4a6670] uppercase tracking-wide">Agent Address</span>
            <input value={agent} onChange={e => setAgent(e.target.value)}
              className="w-full bg-[#050508] border border-[#0d1a24] rounded-lg px-3 py-2 text-xs font-mono text-[#c8e6ea] focus:outline-none focus:border-[#00D4FF]/40"
              placeholder="0x..." />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] text-[#4a6670] uppercase tracking-wide">
              Accuracy: <span className="text-[#c8e6ea]">{accuracy}%</span>
            </span>
            <input type="range" min={1} max={100} value={accuracy}
              onChange={e => setAccuracy(Number(e.target.value))}
              className="w-full accent-[#00D4FF]" />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] text-[#4a6670] uppercase tracking-wide">Verifications</span>
            <input type="number" min={1} value={verifs}
              onChange={e => setVerifs(Number(e.target.value))}
              className="w-full bg-[#050508] border border-[#0d1a24] rounded-lg px-3 py-2 text-xs font-mono text-[#c8e6ea] focus:outline-none focus:border-[#00D4FF]/40" />
          </label>
        </div>

        {result && (
          <div className={`text-xs rounded-lg px-3 py-2 ${
            result.ok
              ? "bg-[#00FF88]/5 border border-[#00FF88]/20 text-[#00FF88]"
              : "bg-[#FF4060]/5 border border-[#FF4060]/20 text-[#FF4060]"
          }`}>
            {result.ok ? (
              <>Event emitted.{" "}
                <a href={`https://explorer.execution.testnet.lukso.network/tx/${result.txHash}`}
                  target="_blank" rel="noreferrer" className="underline">View tx ↗</a>
              </>
            ) : result.error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={handleSimulate} disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#605CFF]/10 border border-[#605CFF]/40 text-[#605CFF] font-semibold text-sm hover:bg-[#605CFF]/20 disabled:opacity-50 transition">
            {pending ? "Sending…" : "⚡ Simulate"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#0d1a24] text-[#4a6670] text-sm hover:text-[#c8e6ea] transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
