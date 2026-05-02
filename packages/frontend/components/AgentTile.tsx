"use client";

import { useState } from "react";
import Link from "next/link";
import MothLogo, { MothVariant, scoreColor } from "./MothLogo";

export interface AgentTileData {
  agentAddress: string;
  score: number;
  verifications: number;
  variant: MothVariant;
  label: string;           // short display name e.g. "Agent-Alpha"
  isGensyn?: boolean;
  isKeeperActive?: boolean;
  lastDeposit?: string;    // e.g. "8.2 LYX"
  claimed?: boolean;
  synced?: boolean;
  floatDelay?: string;
}

interface Props {
  data: AgentTileData;
  index?: number;
}

function clampedScore(s: number) {
  return Math.max(0, Math.min(100, s)).toFixed(1);
}

function statusLabel(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Active";
  if (score >= 60) return "Stable";
  return "Low";
}

export default function AgentTile({ data, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(data.score);
  const delay = data.floatDelay ?? `${(index % 5) * 1.1}s`;

  return (
    <Link
      href={`/agent/${data.agentAddress}`}
      className="relative agent-tile select-none block"
      style={{
        background: "linear-gradient(135deg, #050508 0%, #080b12 100%)",
        border: `1px solid ${color}22`,
        borderRadius: "16px",
        padding: "24px 20px 20px",
        animationDelay: delay,
        textDecoration: "none",
        boxShadow: `0 0 0 1px ${color}11, 0 0 24px ${color}08`,
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* ── Top badges ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        {data.isGensyn ? (
          <span
            className="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded-full"
            style={{
              color: "#FF4F8B",
              background: "rgba(255,79,139,0.08)",
              border: "1px solid rgba(255,79,139,0.22)",
              animation: "live-pulse 2.5s ease-in-out infinite",
            }}
          >
            ● GENSYN
          </span>
        ) : (
          <span className="text-[9px] font-mono text-composia-muted">—</span>
        )}
        {data.synced && (
          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded-full"
            style={{
              color: "#A78BFA",
              background: "rgba(167,139,250,0.07)",
              border: "1px solid rgba(167,139,250,0.18)",
            }}
          >
            ⬡ ETH
          </span>
        )}
      </div>

      {/* ── Moth + score ──────────────────────────────────────────────── */}
      <div
        className="tile-float flex flex-col items-center relative"
        style={{ animationDelay: delay }}
      >
        <MothLogo
          size={160}
          variant={data.variant}
          glowColor={color}
          animDelay={delay}
          animated
        />
        {/* Score floating over nucleus */}
        <div
          className="absolute font-mono font-bold tracking-tight"
          style={{
            // Vertically centre on the nucleus (viewBox nucleus is at ~50% height of SVG)
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color,
            fontSize: data.score >= 100 ? "22px" : "26px",
            lineHeight: 1,
            textShadow: `0 0 16px ${color}99, 0 0 32px ${color}44`,
            pointerEvents: "none",
          }}
        >
          {clampedScore(data.score)}
        </div>
      </div>

      {/* ── Agent label ───────────────────────────────────────────────── */}
      <div className="mt-3 text-center space-y-1">
        <div
          className="text-xs font-mono font-semibold tracking-wide"
          style={{ color: "rgba(200,230,234,0.85)" }}
        >
          {data.label}
        </div>
        <div className="text-[10px] font-mono" style={{ color: `${color}99` }}>
          {statusLabel(data.score)}  ·  {data.verifications.toLocaleString()} verif.
        </div>
      </div>

      {/* ── Bottom badges ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-1.5 mt-3">
        {data.isKeeperActive && (
          <Badge color="#00C896" label="KeeperHub" />
        )}
        {data.lastDeposit && (
          <Badge color="#FF8C5A" label={`Deposit ${data.lastDeposit}`} />
        )}
        {data.claimed ? (
          <Badge color="#00C896" label="Claimed" />
        ) : (
          <Badge color="#4a6670" label="Unclaimed" />
        )}
      </div>

      {/* ── Expanded overlay (hover, no actions) ─────────────────────── */}
      {expanded && (
        <div
          className="absolute inset-0 rounded-2xl flex flex-col justify-end p-4 gap-2 z-10"
          style={{
            background: `linear-gradient(to top, ${color}18 0%, transparent 50%)`,
            backdropFilter: "blur(1px)",
          }}
        >
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: "rgba(5,5,8,0.92)",
              border: `1px solid ${color}22`,
            }}
          >
            <div className="text-[10px] font-mono text-composia-muted uppercase tracking-widest mb-1">
              Agent Breakdown
            </div>
            <Row label="Address"      value={`${data.agentAddress.slice(0,8)}…${data.agentAddress.slice(-6)}`} />
            <Row label="Score"        value={clampedScore(data.score)} color={color} />
            <Row label="Verifications" value={data.verifications.toLocaleString()} />
            <Row label="Chain"        value={data.synced ? "Lukso + ETH Sepolia" : "Lukso only"} />
            <Row label="UP Status"    value={data.claimed ? "Claimed" : "Pending claim"} />
          </div>
        </div>
      )}
    </Link>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
      style={{
        color,
        background: `${color}10`,
        border: `1px solid ${color}25`,
      }}
    >
      {label}
    </span>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-[10px] font-mono">
      <span style={{ color: "rgba(74,102,112,0.9)" }}>{label}</span>
      <span style={{ color: color ?? "rgba(200,230,234,0.8)" }}>{value}</span>
    </div>
  );
}
