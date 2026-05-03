"use client";

import { useState } from "react";

// Moth wing node positions relative to the header button (% units, bilateral symmetry)
const NODES = [
  { x:  4, y: 30, r: 3, center: false },
  { x:  8, y: 68, r: 3, center: false },
  { x: 13, y: 45, r: 2, center: false },
  { x: 16, y: 18, r: 2, center: false },
  { x: 11, y: 80, r: 2, center: false },
  { x: 96, y: 30, r: 3, center: false },
  { x: 92, y: 68, r: 3, center: false },
  { x: 87, y: 45, r: 2, center: false },
  { x: 84, y: 18, r: 2, center: false },
  { x: 89, y: 80, r: 2, center: false },
  { x: 50, y: 50, r: 5, center: true  },
];

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  titleRight?: React.ReactNode;
  noPadding?: boolean;
}

export default function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
  badge,
  titleRight,
  noPadding = false,
}: Props) {
  const [open, setOpen]     = useState(defaultOpen);
  const [hovered, setHover] = useState(false);

  return (
    <div
      className="bg-composia-card rounded-xl overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hovered ? "rgba(123,97,255,0.28)" : "rgba(13,26,36,1)"}`,
        boxShadow: hovered
          ? "0 0 0 1px rgba(123,97,255,0.08), 0 8px 32px rgba(123,97,255,0.06)"
          : "none",
        transition: "border-color 0.25s ease-out, box-shadow 0.25s ease-out",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative w-full flex items-center justify-between px-5 py-4 text-left"
        style={{
          background: open
            ? "rgba(123,97,255,0.04)"
            : hovered
            ? "rgba(123,97,255,0.025)"
            : "transparent",
          transition: "background 0.22s ease-out",
        }}
      >
        {/* Moth glow nodes — fade in on hover */}
        {NODES.map((n, i) => (
          <span
            key={i}
            className="absolute pointer-events-none rounded-full"
            style={{
              left:      `${n.x}%`,
              top:       `${n.y}%`,
              width:     `${n.r}px`,
              height:    `${n.r}px`,
              transform: "translate(-50%, -50%)",
              background: n.center ? "#7B61FF" : "#A78BFA",
              boxShadow:  n.center
                ? "0 0 8px rgba(123,97,255,0.55), 0 0 16px rgba(123,97,255,0.2)"
                : "0 0 4px rgba(167,139,250,0.45)",
              opacity:    hovered ? (n.center ? 0.38 : 0.16) : 0,
              transition: `opacity ${0.28 + i * 0.025}s ease`,
            }}
          />
        ))}

        {/* Left: title + optional subtitle + badge */}
        <div className="flex flex-col gap-0.5 z-10 relative">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#EDEFF6] text-sm">{title}</span>
            {badge}
          </div>
          {subtitle && (
            <span className="font-mono text-xs text-[#7B61FF]">{subtitle}</span>
          )}
        </div>

        {/* Right: extra info + chevron */}
        <div className="flex items-center gap-3 z-10 relative">
          {titleRight}
          <span
            className="text-[#4A4E62] select-none"
            style={{
              display:    "inline-block",
              fontSize:   "11px",
              lineHeight: 1,
              transition: "transform 0.25s ease",
              transform:  open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* ── Collapsible body (grid-rows trick for smooth height transition) ── */}
      <div
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition:       "grid-template-rows 0.28s ease-in-out",
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div
            className={noPadding ? "" : "px-5 pb-5"}
            style={{
              opacity:    open ? 1 : 0,
              transform:  open ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.22s ease, transform 0.22s ease",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
