"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SimulateResponse } from "@/lib/types";
import { ChevronDown } from "lucide-react";

interface LogEntry {
  time: string;
  type: "info" | "success" | "error" | "tx";
  message: string;
}

interface GensynAgent {
  peerId: string;
  eoa: string;
  wins: number;
  voteCount: number;
  accuracy: number;
}

interface KeeperEvent {
  agent: string;
  accuracy: number;
  verifications: number;
  blockNumber: number;
  txHash: string;
  hasUP: boolean;
  upAddress?: string;
}

interface KeeperResult {
  agent: string;
  action: "created" | "updated" | "skipped" | "error";
  upAddress?: string;
  kmAddress?: string;
  error?: string;
}

// ── Mini gauge (self-contained, no deps) ────────────────────────────────────
const RADIUS = 34;
const CIRC   = 2 * Math.PI * RADIUS;

function gaugeColor(a: number) {
  if (a >= 90) return "#A78BFA";
  if (a >= 75) return "#7B61FF";
  if (a >= 60) return "#A78BFA";
  return "#6B7280";
}
function tierLabel(a: number) {
  if (a >= 90) return "Excellent";
  if (a >= 75) return "Good";
  if (a >= 60) return "Average";
  return "Low";
}
function consistencyLabel(a: number) {
  if (a >= 90) return { text: "↑ Rising", cls: "text-[#A78BFA]" };
  if (a >= 75) return { text: "→ Stable", cls: "text-gray-500" };
  return { text: "↓ Declining", cls: "text-gray-500" };
}

function MiniGauge({ accuracy }: { accuracy: number }) {
  const color    = gaugeColor(accuracy);
  const progress = (accuracy / 100) * CIRC;
  const consist  = consistencyLabel(accuracy);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg viewBox="0 0 84 84" className="w-28 h-28 -rotate-90">
          <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="#0d1a24" strokeWidth="8" />
          <circle
            cx="42" cy="42" r={RADIUS}
            fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${progress} ${CIRC}`}
            style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-sora font-bold leading-none" style={{ color }}>{accuracy}</span>
          <span className="text-[9px] text-gray-500 mt-0.5">{tierLabel(accuracy)}</span>
        </div>
      </div>
      <span className={`text-xs font-medium ${consist.cls}`}>{consist.text}</span>
      <span className="text-[10px] text-gray-600">Reputation Score</span>
    </div>
  );
}

// ── Profile moth build-up ────────────────────────────────────────────────────
function ProfileMoth({ accuracy, buildStep }: { accuracy: number; buildStep: 0 | 1 | 2 | 3 }) {
  const color   = gaugeColor(accuracy);
  const consist = consistencyLabel(accuracy);

  if (buildStep === 0) return <MiniGauge accuracy={accuracy} />;

  const CX = 42, CY = 32;
  const isComplete = buildStep === 3;

  const NODES = [
    { x: CX,    y: CY,    r: 4.5, delay: 0,   glow: true  },
    { x: CX,    y: CY-12, r: 2.2, delay: 180, glow: false },
    { x: CX-14, y: CY-8,  r: 2.2, delay: 360, glow: false },
    { x: CX+14, y: CY-8,  r: 2.2, delay: 360, glow: false },
    { x: CX-30, y: CY,    r: 1.8, delay: 540, glow: false },
    { x: CX+30, y: CY,    r: 1.8, delay: 540, glow: false },
    { x: CX-14, y: CY+14, r: 1.8, delay: 540, glow: false },
    { x: CX+14, y: CY+14, r: 1.8, delay: 540, glow: false },
  ] as const;

  const EDGES: [number, number, number][] = [
    [0,1,260], [0,2,440], [0,3,440], [0,6,440], [0,7,440],
    [1,2,450], [1,3,450],
    [2,4,630], [3,5,630], [2,6,630], [3,7,630],
  ];

  const anim = (delay: number) => ({
    animation: `moth-node-appear 0.4s ease both`,
    animationDelay: `${delay}ms`,
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 84 84" className="w-28 h-28">
        <defs>
          <filter id="pm-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {EDGES.map(([a, b, d], i) => (
          <line key={i}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke={color} strokeWidth={0.6} strokeOpacity={0.35}
            style={anim(d)}
          />
        ))}

        {NODES.map((n, i) => (
          <circle key={i}
            cx={n.x} cy={n.y} r={n.r}
            fill={color}
            fillOpacity={i === 0 ? 0.9 : 0.65}
            filter={n.glow ? "url(#pm-glow)" : undefined}
            style={anim(n.delay)}
          />
        ))}

        {isComplete && (
          <circle cx={CX} cy={CY} r={6} fill="none" stroke={color} strokeWidth={0.6} strokeOpacity={0}>
            <animate attributeName="r" values="6;20;6" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
          </circle>
        )}

        {isComplete && (
          <text x={CX} y={CY + 5}
            textAnchor="middle" fontSize="8"
            fontFamily="monospace" fontWeight="bold"
            fill={color}
            style={anim(300)}
          >
            {accuracy}
          </text>
        )}
      </svg>

      <span className={`text-xs font-medium ${consist.cls}`}>{consist.text}</span>
      <span className="text-[10px] text-gray-600 flex items-center gap-1">
        {isComplete ? (
          <>
            <svg viewBox="0 0 12 8" className="w-3 h-2 shrink-0" fill="none">
              <circle cx="6" cy="4" r="1" fill={color} />
              <ellipse cx="3" cy="3" rx="2.5" ry="1.5" fill={color} fillOpacity="0.5" />
              <ellipse cx="9" cy="3" rx="2.5" ry="1.5" fill={color} fillOpacity="0.5" />
            </svg>
            Composia Identity Activated
          </>
        ) : "Activating…"}
      </span>
    </div>
  );
}

// ── Journey steps ────────────────────────────────────────────────────────────
const JOURNEY = [
  {
    icon: "1",
    label: "Gensyn verification",
    desc: "Agent completes ML tasks on Gensyn RL Swarm. MockGensyn emits VerificationCompleted(agent, accuracy, verifications) on LUKSO Testnet.",
  },
  {
    icon: "2",
    label: "KeeperHub detects it",
    desc: "KeeperHub listens for the event on-chain. If accuracy ≥ 80% and verifications ≥ 100, it triggers POST /api/keeper automatically.",
  },
  {
    icon: "3",
    label: "Universal Profile created",
    desc: "A LUKSO UP (LSP0) + KeyManager (LSP6) are deployed. Reputation data is written to the UP via setDataBatch — gensyn:accuracy, verifications, LSP3 profile.",
  },
  {
    icon: "4",
    label: "ENS subdomain registered",
    desc: "a1b2c3d4.composia.eth is minted on Ethereum Sepolia. Text records store live reputation. Fuses CANNOT_UNWRAP + CANNOT_SET_RESOLVER are burned to protect governance reads.",
  },
  {
    icon: "5",
    label: "Reputation state seeded",
    desc: "ReputationState.sol on Sepolia is populated: verification threshold, follower quorum for governance, and DeFi composability hooks (isCurrentlyVerified, getQuorum).",
  },
  {
    icon: "6",
    label: "Agent claims ownership",
    desc: "Agent visits /claim/[address], connects wallet, and calls acceptOwnership(). After this, the agent fully controls their UP — Composia retains no access.",
  },
  {
    icon: "7",
    label: "Composability unlocked",
    desc: "Followers on Sepolia form a governance quorum. Verified agents unlock DeFi collateral terms, DAO vote weights, and service marketplace access. ERC-8004 makes the agent discoverable cross-chain.",
  },
];

// ── How it works cards ──────────────────────────────────────────────────────
const CARDS = [
  { title: "Verification", desc: "Gensyn proves agent performance" },
  { title: "Automation",   desc: "Events trigger identity updates" },
  { title: "Identity",     desc: "Universal Profile created on LUKSO" },
  { title: "Naming",       desc: "ENS links identity to readable name" },
  { title: "Reputation",   desc: "Data stored and synced on-chain" },
  { title: "Ownership",    desc: "Agent controls its identity" },
  { title: "Composable",   desc: "Usable across protocols" },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [agent, setAgent]               = useState("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const [accuracy, setAccuracy]         = useState(95);
  const [verifications, setVerifications] = useState(1000);
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [simulating, setSimulating]     = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [lastSimulatedAgent, setLastSimulatedAgent] = useState<string | null>(null);
  const [profileCreated, setProfileCreated]         = useState(false);
  const [buildStep, setBuildStep] = useState<0 | 1 | 2 | 3>(0);
  const [simKey, setSimKey]       = useState(0);

  // ── Gensyn seed state ───────────────────────────────────────────────────────
  const [seedRunning, setSeedRunning]     = useState(false);
  const [seedPreview, setSeedPreview]     = useState<GensynAgent[] | null>(null);
  const [seedResult, setSeedResult]       = useState<{ txHash: string; count: number } | null>(null);
  const [seedError, setSeedError]         = useState<string | null>(null);
  const [chainStats, setChainStats]       = useState<{ round: number; voters: number } | null>(null);
  const [peerInput, setPeerInput]         = useState("");

  // ── Keeper state ────────────────────────────────────────────────────────────
  const [keeperAuto, setKeeperAuto]       = useState(false);
  const [keeperRunning, setKeeperRunning] = useState(false);
  const [keeperEvents, setKeeperEvents]   = useState<KeeperEvent[]>([]);
  const [keeperResults, setKeeperResults] = useState<KeeperResult[]>([]);
  const [keeperLastRun, setKeeperLastRun] = useState<string | null>(null);
  const [keeperError, setKeeperError]     = useState<string | null>(null);
  const [keeperConfigured, setKeeperConfigured] = useState<boolean | null>(null);
  const keeperTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [gensynOpen, setGensynOpen] = useState(false);
  const [keeperOpen, setKeeperOpen] = useState(false);

  async function runKeeper(action: "scan" | "run" = "scan") {
    setKeeperRunning(true);
    setKeeperError(null);
    try {
      const res  = await fetch("/api/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lookbackBlocks: 500 }),
      });
      const data = await res.json();
      setKeeperConfigured(data.configured ?? false);
      if (data.ok) {
        setKeeperEvents(data.events ?? []);
        if (data.results?.length) {
          setKeeperResults((prev) => [...data.results, ...prev].slice(0, 20));
        }
        setKeeperLastRun(new Date().toLocaleTimeString("en-US", { hour12: false }));
      } else {
        setKeeperError(data.error ?? "Unknown error");
      }
    } catch (err: unknown) {
      setKeeperError(err instanceof Error ? err.message : "Network error");
    } finally {
      setKeeperRunning(false);
    }
  }

  // Auto-mode: run keeper every 8 seconds
  useEffect(() => {
    if (keeperAuto) {
      runKeeper("run");
      keeperTimerRef.current = setInterval(() => runKeeper("run"), 8000);
    } else {
      if (keeperTimerRef.current) {
        clearInterval(keeperTimerRef.current);
        keeperTimerRef.current = null;
      }
    }
    return () => {
      if (keeperTimerRef.current) clearInterval(keeperTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keeperAuto]);

  async function fetchChainStats() {
    try {
      const res  = await fetch("/api/gensyn");
      const data = await res.json();
      if (data.ok) setChainStats({ round: data.currentRound, voters: data.uniqueVoters });
    } catch { /* silent */ }
  }

  async function lookupPeer() {
    const peers = peerInput.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
    if (peers.length === 0) return;
    setSeedRunning(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const res  = await fetch(`/api/gensyn?peers=${encodeURIComponent(peers.join(","))}`);
      const data = await res.json();
      if (data.ok) {
        setSeedPreview(data.agents ?? []);
        if (data.currentRound) setChainStats({ round: data.currentRound, voters: data.uniqueVoters });
      } else {
        setSeedError(data.error ?? "Failed to fetch peer data");
      }
    } catch (err: unknown) {
      setSeedError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSeedRunning(false);
    }
  }

  async function runSeed() {
    if (!seedPreview?.length) return;
    setSeedRunning(true);
    setSeedError(null);
    setSeedResult(null);
    try {
      const eligible = seedPreview.filter((a) => a.eoa !== "0x0000000000000000000000000000000000000000");
      if (eligible.length === 0) {
        setSeedError("No agents with resolved EOA addresses to seed");
        return;
      }
      const res  = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: eligible.map((a) => ({ agent: a.eoa, accuracy: a.accuracy || 1, verifications: a.voteCount || 1 })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSeedResult({ txHash: data.txHash, count: eligible.length });
        addLog("success", `Seeded ${eligible.length} real Gensyn agent(s) into MockGensyn ✓`);
        addLog("tx", `TX: ${data.txHash}`);
        addLog("info", "Keeper will now create Universal Profiles for these agents…");
      } else {
        setSeedError(data.error ?? "Seed failed");
        addLog("error", `Seed failed: ${data.error}`);
      }
    } catch (err: unknown) {
      setSeedError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSeedRunning(false);
    }
  }

  function addLog(type: LogEntry["type"], message: string) {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [{ time, type, message }, ...prev]);
  }

  async function handleSimulate() {
    setSimulating(true);
    setProfileCreated(false);
    setBuildStep(1);
    setSimKey(k => k + 1);
    addLog("info", `Simulating Gensyn event — agent ${agent.slice(0, 10)}… accuracy=${accuracy}% verifications=${verifications}`);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, accuracy, verifications }),
      });
      const data: SimulateResponse = await res.json();

      if (data.success) {
        addLog("tx", `TX: ${data.txHash}`);
        addLog("success", "VerificationCompleted event emitted on Lukso Testnet ✓");
        addLog("info", "KeeperHub detected event — deploying Universal Profile + KeyManager…");
        setLastSimulatedAgent(agent);
      setTimeout(() => setBuildStep(2), 600);

        if (data.preview) {
          setTimeout(() => {
            addLog("success", `Universal Profile deployed: ${agent.slice(0,10)}…${agent.slice(-4)} ✓`);
            addLog("success", "LSP6 KeyManager deployed and linked ✓");
            addLog("info", "LSP3 reputation data written via setDataBatch ✓");
            setProfileCreated(true);
            setBuildStep(3);
          }, 1200);
        } else {
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            try {
              const profileRes = await fetch(`/api/agent/${agent}`);
              if (profileRes.ok) {
                const profile = await profileRes.json();
                if (profile.upAddress) {
                  addLog("success", `Universal Profile deployed: ${profile.upAddress} ✓`);
                  addLog("success", "LSP6 KeyManager deployed and linked ✓");
                  addLog("info", "Agent can now claim ownership via /claim");
                  setProfileCreated(true);
                  setBuildStep(3);
                  clearInterval(poll);
                }
              }
            } catch { /* ignore poll errors */ }
            if (attempts >= 10) {
              addLog("info", "Profile check timed out — check listener logs.");
              clearInterval(poll);
            }
          }, 3000);
        }
      } else {
        addLog("error", `Failed: ${data.error}`);
        setBuildStep(0);
      }
    } catch (err: unknown) {
      addLog("error", `Network error: ${err instanceof Error ? err.message : String(err)}`);
      setBuildStep(0);
    } finally {
      setSimulating(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    addLog("info", "Syncing all unsynced agents to Ethereum Sepolia via Hyperlane…");
    try {
      const res  = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addLog("tx", `TX: ${data.txHash}`);
        addLog("success", `Synced ${data.synced} agent(s) to Ethereum Sepolia ✓`);
      } else {
        addLog("error", `Sync failed: ${data.error}`);
      }
    } catch (err: unknown) {
      addLog("error", `Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  const correct = Math.round((accuracy / 100) * verifications);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold glow-cyan">Portable Identity</h1>
        <p className="text-composia-muted mt-2 text-sm">
          Simulate a Gensyn verification and watch it become a portable identity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Controls + Log ─────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Controls */}
          <div className="demo-card bg-composia-card border border-composia-border rounded-xl p-6 space-y-5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">
              Simulate Gensyn Event
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Agent Address</label>
                <input
                  className="w-full bg-composia-dark border border-composia-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-composia-cyan"
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Accuracy — <span className="text-white font-medium">{accuracy}%</span>
                  </label>
                  <input
                    type="range" min={0} max={100}
                    className="w-full accent-[#7B61FF]"
                    value={accuracy}
                    onChange={(e) => setAccuracy(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Verifications — <span className="text-white font-medium">{verifications.toLocaleString()}</span>
                  </label>
                  <input
                    type="range" min={10} max={10000} step={10}
                    className="w-full accent-[#7B61FF]"
                    value={verifications}
                    onChange={(e) => setVerifications(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="flex-1 bg-composia-cyan hover:bg-composia-cyan/90 disabled:opacity-50 text-black font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {simulating ? "Simulating…" : "Simulate Gensyn Event"}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 border border-composia-border hover:border-composia-cyan/50 disabled:opacity-50 text-composia-text font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {syncing ? "Syncing…" : "Sync to Ethereum"}
              </button>
            </div>
          </div>

          {/* Event log */}
          <div className="demo-card bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Event Log</h2>
              {logs.length > 0 && (
                <button onClick={() => setLogs([])} className="text-xs text-gray-600 hover:text-gray-400">
                  Clear
                </button>
              )}
            </div>
            <div className="min-h-[160px] max-h-[260px] overflow-y-auto space-y-1.5 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-gray-600 italic">Logs will appear here after simulation…</p>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${
                      log.type === "success" ? "text-[#A78BFA]" :
                      log.type === "error"   ? "text-gray-400"  :
                      log.type === "tx"      ? "text-[#7B61FF]" :
                      "text-gray-400"
                    }`}
                  >
                    <span className="text-gray-600 shrink-0">{log.time}</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Live preview + journey ────────────────────────────────── */}
        <div className="space-y-5">

          {/* Live preview card */}
          <div className="demo-card bg-composia-card border border-composia-border rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">
                Profile Preview
              </h2>
              <span className="text-[10px] bg-composia-cyan/10 text-composia-cyan border border-composia-cyan/20 px-2 py-0.5 rounded-full">
                live
              </span>
            </div>

            <div className="flex items-center gap-6">
              <ProfileMoth key={simKey} accuracy={accuracy} buildStep={buildStep} />
              <div className="flex-1 space-y-3">
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-gray-500 break-all">
                    {agent.slice(0, 14)}…{agent.slice(-6)}
                  </div>
                  <div className="text-white font-semibold text-sm">
                    Gensyn Agent {agent.slice(2, 8).toUpperCase()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Problems Solved", value: verifications.toLocaleString() },
                    { label: "Correct",         value: correct.toLocaleString() },
                    { label: "Accuracy Tier",   value: tierLabel(accuracy) },
                    { label: "Sync Status",     value: "Pending" },
                  ].map((s) => (
                    <div key={s.label} className="demo-card bg-composia-dark/60 rounded-lg p-2">
                      <div className="text-[9px] text-gray-500">{s.label}</div>
                      <div className="text-xs font-bold mt-0.5 text-white">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Verification → Identity → Composable flow */}
            {buildStep > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                {(["Verification", "Identity", "Composable"] as const).map((label, i) => {
                  const active = buildStep > i;
                  const c = gaugeColor(accuracy);
                  return (
                    <span key={label} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span style={{ fontSize: 8, color: active ? c : "#2A2C3A", transition: "color 0.5s ease" }}>→</span>
                      )}
                      <span style={{
                        fontSize: 9, fontFamily: "Space Grotesk, sans-serif",
                        letterSpacing: "0.05em", textTransform: "uppercase",
                        color: active ? c : "#2A2C3A",
                        transition: "color 0.6s ease",
                      }}>
                        {label}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* What Composia writes */}
            <div className="border-t border-composia-border pt-4 space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                Composia will write to your Universal Profile
              </div>
              {[
                ["SupportedStandards:LSP3Profile", "magic bytes"],
                ["LSP3Profile", "name · description · tags"],
                ["gensyn:reputation", `${accuracy}%`],
                ["gensyn:verifications", verifications.toLocaleString()],
                ["gensyn:correct", correct.toLocaleString()],
                ["AddressPermissions:Permissions", "SETDATA (composia) + ALL (agent)"],
              ].map(([key, val]) => (
                <div key={key} className="flex justify-between text-[10px]">
                  <span className="font-mono text-gray-500 truncate mr-2">{key}</span>
                  <span className="text-gray-300 shrink-0">{val}</span>
                </div>
              ))}
            </div>

            {/* CTA after successful simulation */}
            {lastSimulatedAgent && (
              <div className={`rounded-lg p-4 space-y-2 transition-all ${
                profileCreated
                  ? "bg-[#7B61FF]/10 border border-[#7B61FF]/25"
                  : "bg-composia-dark/60 border border-composia-border"
              }`}>
                {profileCreated ? (
                  <>
                    <div className="text-[#A78BFA] font-medium text-sm">
                      ✓ Universal Profile created on Lukso
                    </div>
                    <p className="text-xs text-gray-400">
                      UP + KeyManager deployed. Agent can now claim ownership.
                    </p>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">
                    Waiting for listener to deploy Universal Profile…
                  </div>
                )}
                <div className="flex gap-2 flex-wrap pt-1">
                  <Link
                    href={`/agent/${lastSimulatedAgent}`}
                    className="text-xs bg-composia-cyan text-black px-3 py-1.5 rounded-lg hover:bg-composia-cyan/90 transition-colors"
                  >
                    View full profile →
                  </Link>
                  {profileCreated && (
                    <Link
                      href={`/claim/${lastSimulatedAgent}`}
                      className="text-xs border border-composia-border px-3 py-1.5 rounded-lg hover:border-composia-cyan/50 text-composia-text transition-colors"
                    >
                      Claim ownership →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Journey */}
          <div className="demo-card bg-composia-card border border-composia-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">
              How it works
            </h2>
            <div className="flex flex-wrap gap-2">
              {CARDS.map((card) => (
                <div
                  key={card.title}
                  className="demo-card bg-composia-dark/60 border border-composia-border rounded-lg p-3 min-w-[108px] flex-1"
                >
                  <div className="text-xs font-semibold text-white">{card.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── GENSYN REAL DATA PANEL ───────────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-composia-border cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setGensynOpen(v => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#7B61FF] animate-pulse" />
            <span className="font-semibold text-sm">Gensyn Verification (Simulated)</span>
            <span className="text-[10px] text-gray-500 border border-composia-border rounded-full px-2 py-0.5">
              SwarmCoordinator · chain 685685
            </span>
          </div>
          <div className="flex items-center gap-4">
            {chainStats && (
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span><span className="text-white font-medium">{chainStats.round.toLocaleString()}</span> rounds</span>
                <span><span className="text-white font-medium">{chainStats.voters.toLocaleString()}</span> unique voters</span>
              </div>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${gensynOpen ? "rotate-180" : ""}`} />
          </div>
        </div>

        {gensynOpen && <div className="p-5 space-y-4">
          {/* Explanation */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              Enter your Gensyn <span className="font-mono text-gray-300">peer ID</span> (shown in your terminal when you run rl-swarm).
              Composia reads your real wins and participation count from the{" "}
              <span className="font-mono text-gray-300">SwarmCoordinator</span> contract,
              then registers your Ethereum address on Lukso.
            </p>
          </div>

          {/* Peer ID input */}
          <div className="space-y-2">
            <label className="text-[10px] text-gray-400 uppercase tracking-wide">Peer ID(s)</label>
            <textarea
              className="w-full bg-composia-dark border border-composia-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-composia-cyan resize-none text-gray-300 placeholder-gray-700"
              rows={2}
              placeholder={"Qm... or 12D3KooW...\nOne per line or comma-separated"}
              value={peerInput}
              onChange={(e) => setPeerInput(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { fetchChainStats(); lookupPeer(); }}
                disabled={seedRunning || !peerInput.trim()}
                className="flex-1 border border-composia-border hover:border-composia-cyan/50 disabled:opacity-40 text-composia-text text-xs font-medium py-2 rounded-lg transition-colors"
              >
                {seedRunning && !seedResult ? "Querying chain…" : "Look up on Gensyn"}
              </button>
              <button
                onClick={runSeed}
                disabled={seedRunning || !seedPreview?.length}
                className="flex-1 bg-composia-cyan hover:bg-composia-cyan/90 disabled:opacity-40 text-black text-xs font-medium py-2 rounded-lg transition-colors"
              >
                {seedRunning && seedPreview?.length ? "Seeding…" : "Bridge to Lukso"}
              </button>
            </div>
          </div>

          {seedError && (
            <div className="text-xs text-gray-400 bg-white/5 border border-white/[0.08] rounded p-3">
              {seedError}
            </div>
          )}

          {seedResult && (
            <div className="text-xs text-[#A78BFA] bg-[#7B61FF]/10 border border-[#7B61FF]/20 rounded p-3 space-y-1">
              <div className="font-medium">✓ {seedResult.count} real Gensyn agent(s) bridged to Lukso testnet</div>
              <div className="font-mono text-gray-400">TX: {seedResult.txHash.slice(0, 20)}…</div>
              <div className="text-gray-500">Run the KeeperHub panel below to create their Universal Profiles.</div>
            </div>
          )}

          {seedPreview && seedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Gensyn agent data (live from chain)</div>
              <div className="space-y-2">
                {seedPreview.map((a) => (
                  <div
                    key={a.peerId}
                    className="bg-composia-dark/60 border border-composia-border rounded-lg p-3 grid grid-cols-3 gap-2"
                  >
                    <div className="col-span-3 space-y-0.5">
                      <div className="text-[9px] text-gray-600 truncate font-mono">{a.peerId}</div>
                      <div className="font-mono text-[10px] text-gray-400">
                        EOA: {a.eoa === "0x0000000000000000000000000000000000000000"
                          ? <span className="text-gray-500">not registered</span>
                          : <>{a.eoa.slice(0, 10)}…{a.eoa.slice(-4)}</>
                        }
                      </div>
                    </div>
                    {[
                      { label: "Wins", value: a.wins.toLocaleString() },
                      { label: "Rounds", value: a.voteCount.toLocaleString() },
                      { label: "Win Rate", value: `${a.accuracy}%` },
                    ].map((s) => (
                      <div key={s.label} className="bg-composia-dark rounded p-2">
                        <div className="text-[9px] text-gray-600">{s.label}</div>
                        <div className="text-xs font-bold text-white">{s.value}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!seedPreview && !seedError && (
            <p className="text-[11px] text-gray-600 italic">
              Your peer ID is printed in the rl-swarm terminal as{" "}
              <span className="font-mono">Your peer ID is QmXXX…</span>
            </p>
          )}
        </div>}
      </div>

      {/* ── KEEPERHUB PANEL ──────────────────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-composia-border">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setKeeperOpen(v => !v)}
          >
            <div className={`w-2 h-2 rounded-full ${keeperAuto ? "bg-[#7B61FF] animate-pulse" : "bg-[#2A2C3A]"}`} />
            <span className="font-semibold text-sm">Automation (Local Execution)</span>
            <span className="text-[10px] text-gray-500 border border-composia-border rounded-full px-2 py-0.5">
              decentralized keeper
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${keeperOpen ? "rotate-180" : ""}`} />
          </div>
          <div className="flex items-center gap-3">
            {keeperLastRun && (
              <span className="text-[10px] text-gray-500">last run: {keeperLastRun}</span>
            )}
            <button
              onClick={() => setKeeperAuto((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                keeperAuto ? "bg-[#7B61FF]" : "bg-[#1E1F2E]"
              }`}
            >
              <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                keeperAuto ? "translate-x-5" : "translate-x-1"
              }`} />
            </button>
            <span className="text-xs text-gray-400">{keeperAuto ? "Auto ON" : "Auto OFF"}</span>
            <button
              onClick={() => runKeeper("scan")}
              disabled={keeperRunning}
              className="text-xs border border-composia-border hover:border-composia-cyan/50 disabled:opacity-40 px-3 py-1.5 rounded-lg text-composia-text transition-colors"
            >
              {keeperRunning ? "Scanning…" : "Scan"}
            </button>
            <button
              onClick={() => runKeeper("run")}
              disabled={keeperRunning}
              className="text-xs bg-composia-cyan hover:bg-composia-cyan/90 disabled:opacity-40 px-3 py-1.5 rounded-lg text-black transition-colors"
            >
              {keeperRunning ? "Running…" : "Run Once"}
            </button>
          </div>
        </div>

        {keeperOpen && <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-composia-border">

          {/* Detected events */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chain Events</h3>
              <span className="text-[10px] bg-composia-dark border border-composia-border rounded px-1.5 py-0.5 text-gray-400">
                last 500 blocks
              </span>
            </div>
            {keeperEvents.length === 0 ? (
              <p className="text-[11px] text-gray-600 italic">Waiting for events</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {keeperEvents.map((ev) => (
                  <div
                    key={`${ev.txHash}-${ev.agent}`}
                    className={`rounded-lg p-2.5 space-y-1 border text-[10px] ${
                      ev.hasUP
                        ? "border-gray-700 bg-composia-dark/40"
                        : "border-[#1A1C23] bg-[#1A1C23]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-gray-400">
                        {ev.agent.slice(0, 10)}…{ev.agent.slice(-4)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        ev.hasUP ? "bg-[#7B61FF]/15 text-[#A78BFA]" : "bg-white/[0.04] text-gray-500"
                      }`}>
                        {ev.hasUP ? "✓ UP ready" : "pending"}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      {ev.accuracy}% · {ev.verifications.toLocaleString()} tasks · block {ev.blockNumber}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Keeper Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Events detected", value: keeperEvents.length, color: "text-white" },
                { label: "Pending (no UP)",  value: keeperEvents.filter(e => !e.hasUP).length, color: "text-[#A78BFA]" },
                { label: "Already processed", value: keeperEvents.filter(e => e.hasUP).length, color: "text-[#A78BFA]" },
                { label: "UPs created", value: keeperResults.filter(r => r.action === "created").length, color: "text-composia-violet" },
              ].map((s) => (
                <div key={s.label} className="demo-card bg-composia-dark/60 rounded-lg p-3">
                  <div className={`text-xl font-sora font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] text-gray-500 mb-1">Each keeper run:</div>
              {[
                "Scans chain for VerificationCompleted events",
                "Checks registry for missing Universal Profiles",
                "Deploys UP + LSP6 KeyManager for new agents",
                "Updates LSP3 reputation via KeyManager",
              ].map((step) => (
                <div key={step} className="flex items-start gap-1.5 text-[10px] text-gray-400">
                  <span className="text-[#A78BFA] shrink-0">›</span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          {/* Action log */}
          <div className="p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Action Log</h3>
            {keeperResults.length === 0 ? (
              <p className="text-[11px] text-gray-600 italic">
                {keeperLastRun ? "No new actions — all events already processed." : "Run the keeper to process pending events."}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {keeperResults.map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2.5 border text-[10px] space-y-1 ${
                      r.action === "created" ? "border-[#7B61FF]/25 bg-[#7B61FF]/5" :
                      r.action === "updated" ? "border-[#7B61FF]/25 bg-[#7B61FF]/5" :
                      r.action === "error"   ? "border-[#1A1C23] bg-composia-dark/40" :
                      "border-[#1A1C23] bg-composia-dark/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-gray-400">
                        {r.agent.slice(0, 10)}…{r.agent.slice(-4)}
                      </span>
                      <span className={`font-medium ${
                        r.action === "created" ? "text-[#A78BFA]" :
                        r.action === "updated" ? "text-[#7B61FF]" :
                        r.action === "error"   ? "text-gray-500" : "text-gray-500"
                      }`}>
                        {r.action === "created" ? "✓ UP created" :
                         r.action === "updated" ? "↑ Updated" :
                         r.action === "error"   ? "✗ Error" : "— Skipped"}
                      </span>
                    </div>
                    {r.upAddress && (
                      <Link href={`/agent/${r.agent}`} className="text-composia-cyan hover:underline">
                        View profile →
                      </Link>
                    )}
                    {r.error && <div className="text-gray-500 break-all">{r.error.slice(0, 100)}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>}
      </div>

    </div>
  );
}
