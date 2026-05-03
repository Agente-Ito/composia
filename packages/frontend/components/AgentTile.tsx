"use client";

import { useState } from "react";
import Link from "next/link";
import MothLogo, { MothVariant, scoreColor } from "./MothLogo";

export interface AgentTileData {
  agentAddress: string;
  score: number;
  verifications: number;
  variant: MothVariant;
  label: string;
  isGensyn?: boolean;
  isKeeperActive?: boolean;
  lastDeposit?: string;
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

// 0 = elite, 1 = active, 2 = emerging, 3 = low
function scoreTier(s: number): 0 | 1 | 2 | 3 {
  if (s >= 90) return 0;
  if (s >= 75) return 1;
  if (s >= 60) return 2;
  return 3;
}

function descriptor(s: number): string {
  if (s >= 90) return "Highly reliable";
  if (s >= 75) return "Active agent";
  if (s >= 60) return "Emerging reputation";
  return "Low activity";
}

function tileBorderColor(color: string, tier: 0 | 1 | 2 | 3): string {
  const alphas = ["44", "28", "18", "10"];
  return `${color}${alphas[tier]}`;
}

function tileBoxShadow(color: string, tier: 0 | 1 | 2 | 3): string {
  if (tier === 0) return `0 0 0 1px ${color}22, 0 0 36px ${color}1e, 0 0 72px ${color}0a`;
  if (tier === 1) return `0 0 0 1px ${color}14, 0 0 22px ${color}12`;
  if (tier === 2) return `0 0 0 1px ${color}0e, 0 0 14px ${color}09`;
  return `0 0 0 1px ${color}09`;
}

function scoreTextShadow(color: string, tier: 0 | 1 | 2 | 3): string {
  if (tier === 0) return `0 0 12px ${color}cc, 0 0 24px ${color}66, 0 0 48px ${color}22`;
  if (tier === 1) return `0 0 16px ${color}99, 0 0 32px ${color}44`;
  if (tier === 2) return `0 0 14px ${color}66, 0 0 28px ${color}22`;
  return `0 0 10px ${color}44`;
}

export default function AgentTile({ data, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(data.score);
  const tier  = scoreTier(data.score);
  const delay = data.floatDelay ?? `${(index % 5) * 1.1}s`;

  // Slight rhythm variation: elite floats a touch faster, low agents slower
  const floatDuration = tier === 0 ? "5.4s" : tier === 1 ? "6.2s" : tier === 2 ? "7.0s" : "7.8s";

  return (
    <Link
      href={`/agent/${data.agentAddress}`}
      className="relative agent-tile select-none block"
      style={{
        background: "linear-gradient(135deg, #050508 0%, #080b12 100%)",
        border: `1px solid ${tileBorderColor(color, tier)}`,
        borderRadius: "16px",
        padding: "24px 20px 20px",
        animationDelay: delay,
        textDecoration: "none",
        boxShadow: tileBoxShadow(color, tier),
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Top badges */}
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

      {/* Moth + score */}
      <div
        className="tile-float flex flex-col items-center relative"
        style={{ animationDelay: delay, animationDuration: floatDuration }}
      >
        <MothLogo
          size={160}
          variant={data.variant}
          glowColor={color}
          animDelay={delay}
          animated
          density={tier}
        />
        <div
          className="absolute font-mono font-bold tracking-tight"
          style={{
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color,
            fontSize: data.score >= 100 ? "22px" : "26px",
            lineHeight: 1,
            textShadow: scoreTextShadow(color, tier),
            pointerEvents: "none",
          }}
        >
          {clampedScore(data.score)}
        </div>
      </div>

      {/* Agent label + descriptor */}
      <div className="mt-3 text-center space-y-1">
        <div
          className="text-xs font-mono font-semibold tracking-wide"
          style={{ color: "rgba(200,230,234,0.85)" }}
        >
          {data.label}
        </div>
        <div className="text-[10px] font-mono" style={{ color: `${color}99` }}>
          {descriptor(data.score)}
        </div>
        <div className="text-[9px] font-mono" style={{ color: "rgba(74,102,112,0.6)" }}>
          {data.verifications.toLocaleString("en-US")} verif.
        </div>
      </div>

      {/* Capability badges */}
      <div className="flex flex-wrap justify-center gap-1.5 mt-3">
        {data.isKeeperActive && <Badge color="#00C896" label="KeeperHub" />}
        {data.lastDeposit    && <Badge color="#A78BFA" label={`Deposit ${data.lastDeposit}`} />}
        {data.claimed        && <Badge color="#A78BFA" label="Portable" />}
        {data.synced         && <Badge color="#7B61FF" label="Cross-chain" />}
        {data.isGensyn && tier <= 1 && <Badge color="#C4B5FD" label="Verified" />}
        {!data.claimed       && <Badge color="#4a6670" label="Unclaimed" />}
      </div>

      {/* Expanded hover overlay */}
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
            <Row label="Address"       value={`${data.agentAddress.slice(0,8)}…${data.agentAddress.slice(-6)}`} />
            <Row label="Score"         value={clampedScore(data.score)} color={color} />
            <Row label="Tier"          value={descriptor(data.score)} color={color} />
            <Row label="Verifications" value={data.verifications.toLocaleString("en-US")} />
            <Row label="Chain"         value={data.synced ? "Lukso + ETH Sepolia" : "Lukso only"} />
            <Row label="UP Status"     value={data.claimed ? "Claimed" : "Pending claim"} />
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
