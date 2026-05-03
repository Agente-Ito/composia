"use client";

import { useEffect, useRef, useState } from "react";

export interface FeedEntry {
  id: number;
  time: string;
  agent: string;
  score: number;
  action: string;
  detail?: string;
}

const DEMO_POOL: Omit<FeedEntry, "id" | "time">[] = [
  { agent: "Agent-7F3A",  score: 97.4, action: "exceeded threshold",    detail: "KeeperHub workflow triggered" },
  { agent: "Agent-2C81",  score: 87.4, action: "Gensyn proof verified", detail: "8.2 LYX deposited in LSP Vault" },
  { agent: "Agent-D4E0",  score: 92.7, action: "UP registered",         detail: "Universal Profile deployed on Lukso" },
  { agent: "Agent-09FA",  score: 95.1, action: "cross-chain sync",      detail: "Reputation relayed to ETH Sepolia" },
  { agent: "Agent-B3CC",  score: 78.3, action: "Gensyn proof verified", detail: "3.7 LYX deposited in LSP Vault" },
  { agent: "Agent-41D2",  score: 99.0, action: "score updated",         detail: "⬡ ETH sync scheduled" },
  { agent: "Agent-F1A5",  score: 83.6, action: "KeeperHub active",      detail: "Workflow #14 executed" },
  { agent: "Agent-C900",  score: 91.2, action: "claim initiated",       detail: "Ownership transfer pending" },
  { agent: "Agent-88B7",  score: 74.8, action: "Gensyn proof verified", detail: "2.1 LYX deposited in LSP Vault" },
  { agent: "Agent-3E5D",  score: 96.6, action: "score updated",         detail: "KeeperHub workflow triggered" },
];

let counter = 0;
function nextId() { return ++counter; }

function now() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function scoreColor(s: number): string {
  if (s >= 90) return "#A78BFA";
  if (s >= 75) return "#7B61FF";
  if (s >= 60) return "#A78BFA";
  return "#FF4060";
}

// Detect protocol from event content to determine particle color
function entryParticleColor(entry: Pick<FeedEntry, "action" | "detail">): string {
  const text = `${entry.action} ${entry.detail ?? ""}`.toLowerCase();
  if (text.includes("gensyn")) return "#FF4F8B";   // Gensyn pink
  if (text.includes("keeper")) return "#00C896";   // KeeperHub green
  return "#A78BFA";                                // brand secondary
}

interface Particle {
  id: number;
  color: string;
}

interface Props {
  externalEntries?: FeedEntry[];
  demoInterval?: number;
  className?: string;
}

export default function LiveFeed({
  externalEntries = [],
  demoInterval = 5000,
  className = "",
}: Props) {
  const [entries, setEntries] = useState<FeedEntry[]>(() =>
    DEMO_POOL.slice(0, 6).map((e) => ({ ...e, id: nextId(), time: "" }))
  );
  const [particle, setParticle] = useState<Particle | null>(null);

  const listRef        = useRef<HTMLDivElement>(null);
  const latestIdRef    = useRef<number>(-1);
  const particleTimer  = useRef<ReturnType<typeof setTimeout>>();
  const isFirstRender  = useRef(true);

  // Populate timestamps only on the client
  useEffect(() => {
    setEntries((prev) => prev.map((e) => e.time ? e : { ...e, time: now() }));
  }, []);

  // Auto-scroll to top on new entry
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [entries.length]);

  // Synthetic demo entries
  useEffect(() => {
    if (!demoInterval) return;
    const id = setInterval(() => {
      const template = pickRandom(DEMO_POOL);
      setEntries((prev) => [
        { ...template, id: nextId(), time: now() },
        ...prev.slice(0, 29),
      ]);
    }, demoInterval);
    return () => clearInterval(id);
  }, [demoInterval]);

  // Merge external entries
  useEffect(() => {
    if (!externalEntries.length) return;
    setEntries((prev) => [...externalEntries, ...prev].slice(0, 30));
  }, [externalEntries]);

  // Trigger moth particle on each new entry (skip initial mount)
  useEffect(() => {
    if (!entries.length) return;

    const latest = entries[0];

    if (isFirstRender.current) {
      latestIdRef.current = latest.id;
      isFirstRender.current = false;
      return;
    }

    if (latest.id === latestIdRef.current) return;
    latestIdRef.current = latest.id;

    const color = entryParticleColor(latest);
    setParticle({ id: Date.now(), color });

    clearTimeout(particleTimer.current);
    particleTimer.current = setTimeout(() => setParticle(null), 700);
  }, [entries]);

  return (
    <aside
      className={`flex flex-col h-full relative ${className}`}
      style={{
        background: "#050508",
        borderLeft: "1px solid #0d1a24",
        overflow: "visible",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid #0d1a24" }}
      >
        <span className="text-[11px] font-mono font-bold tracking-widest text-composia-muted uppercase">
          Live Activity
        </span>
        <span
          className="text-[10px] font-mono flex items-center gap-1.5"
          style={{ color: "#A78BFA" }}
        >
          <span className="animate-live-pulse">●</span>
          <span style={{ color: "rgba(74,102,112,0.8)" }}>LIVE</span>
        </span>
      </div>

      {/* Feed list — particle is positioned relative to this wrapper */}
      <div className="relative flex-1 overflow-hidden">
        {/* Moth particle — appears near new entry, drifts toward grid */}
        {particle && (
          <div
            key={particle.id}
            className="particle-event"
            style={{
              width: 6,
              height: 6,
              top: 20,
              left: 18,
              background: particle.color,
              boxShadow: `0 0 8px ${particle.color}, 0 0 18px ${particle.color}88`,
            }}
          />
        )}

        <div ref={listRef} className="h-full overflow-y-auto px-3 py-2 space-y-2">
          {entries.map((entry, i) => (
            <FeedItem key={entry.id} entry={entry} index={i} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 shrink-0 text-[9px] font-mono text-composia-muted"
        style={{ borderTop: "1px solid #0d1a24" }}
      >
        {entries.length} events · Lukso Testnet
      </div>
    </aside>
  );
}

function FeedItem({ entry, index }: { entry: FeedEntry; index: number }) {
  const color = scoreColor(entry.score);
  return (
    <div
      className="feed-entry space-y-0.5"
      style={{
        borderLeft: `2px solid ${color}40`,
        paddingLeft: "8px",
        animationDelay: `${index === 0 ? "0s" : "0.05s"}`,
      }}
    >
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono font-bold" style={{ color }}>
          {entry.agent}
        </span>
        <span className="text-[9px] text-composia-muted">{entry.action}</span>
      </div>
      {entry.detail && (
        <div className="text-[9px] font-mono" style={{ color: "rgba(74,102,112,0.7)" }}>
          → {entry.detail}
        </div>
      )}
      <div className="text-[8px] font-mono text-composia-muted opacity-50" suppressHydrationWarning>
        {entry.time}
      </div>
    </div>
  );
}
