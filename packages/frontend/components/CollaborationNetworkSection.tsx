"use client";

import { useState } from "react";
import SocialNetworkGraph from "@/components/SocialNetworkGraph";
import type { Collaborator } from "@/lib/types";

// Same moth-node positions as CollapsibleSection — bilateral symmetry
const HEADER_NODES = [
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

// Collapsed-state background: mini network across the header strip (viewBox 0 0 400 56)
const BG_NODES = [
  { x:  42, y: 20, r: 2.0, pulse: false },
  { x:  95, y: 36, r: 1.8, pulse: false },
  { x: 155, y: 16, r: 1.5, pulse: false },
  { x: 205, y: 38, r: 4.2, pulse: true  },  // center — breathes
  { x: 255, y: 18, r: 1.8, pulse: false },
  { x: 315, y: 36, r: 2.0, pulse: false },
  { x: 362, y: 22, r: 1.6, pulse: false },
];

const BG_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [0, 2], [1, 3], [3, 5], [4, 6],
];

interface Props {
  agentAddress: string;
  partners: Collaborator[];
  collaboratorsCount: number;
}

export default function CollaborationNetworkSection({
  agentAddress, partners, collaboratorsCount,
}: Props) {
  const [open,          setOpen]         = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [cardHovered,   setCardHovered]   = useState(false);

  const collapsed = !open;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background:   "#080b12",
        border:       `1px solid ${cardHovered && collapsed ? "rgba(123,97,255,0.22)" : "#0d1a24"}`,
        boxShadow:    cardHovered && collapsed ? "0 0 28px rgba(123,97,255,0.07)" : "none",
        transition:   "border-color 0.35s ease, box-shadow 0.35s ease",
      }}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
    >
      {/* ── Collapsed background network ──────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity:    collapsed ? (cardHovered ? 0.80 : 0.42) : 0,
          transition: "opacity 0.40s ease",
          zIndex:     0,
        }}
      >
        <svg
          viewBox="0 0 400 56"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <filter id="bg-center-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {BG_EDGES.map(([a, b], i) => {
            const na = BG_NODES[a], nb = BG_NODES[b];
            return (
              <line
                key={i}
                x1={na.x} y1={na.y}
                x2={nb.x} y2={nb.y}
                stroke="#7B61FF"
                strokeWidth={0.65}
                strokeOpacity={0.38}
              />
            );
          })}

          {/* Nodes */}
          {BG_NODES.map((n, i) => (
            <circle
              key={i}
              cx={n.x} cy={n.y} r={n.r}
              fill={n.pulse ? "#7B61FF" : "#A78BFA"}
              filter={n.pulse ? "url(#bg-center-glow)" : undefined}
            >
              {n.pulse ? (
                <animate
                  attributeName="opacity"
                  values="0.55;1;0.55"
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              ) : (
                <animate
                  attributeName="opacity"
                  values={`${0.38 + (i % 3) * 0.12};${0.65 + (i % 3) * 0.1};${0.38 + (i % 3) * 0.12}`}
                  dur={`${2.4 + i * 0.38}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
        </svg>
      </div>

      {/* ── Header button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        className="relative w-full flex items-center justify-between px-5 py-4 text-left"
        style={{
          background: open ? "rgba(123,97,255,0.02)" : "transparent",
          transition: "background 0.2s ease",
          zIndex:     10,
        }}
      >
        {/* Moth glow nodes — fade in on hover */}
        {HEADER_NODES.map((n, i) => (
          <span
            key={i}
            className="absolute pointer-events-none rounded-full"
            style={{
              left:       `${n.x}%`,
              top:        `${n.y}%`,
              width:      `${n.r}px`,
              height:     `${n.r}px`,
              transform:  "translate(-50%, -50%)",
              background: n.center ? "#7B61FF" : "#A78BFA",
              boxShadow:  n.center
                ? "0 0 8px rgba(123,97,255,0.55), 0 0 16px rgba(123,97,255,0.2)"
                : "0 0 4px rgba(167,139,250,0.45)",
              opacity:    headerHovered ? (n.center ? 0.38 : 0.16) : 0,
              transition: `opacity ${0.28 + i * 0.025}s ease`,
            }}
          />
        ))}

        <span className="font-semibold text-[#EDEFF6] text-sm relative z-10">
          Collaboration Network
        </span>

        <span
          className="text-[#4A4E62] select-none relative z-10"
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
      </button>

      {/* ── Collapsible body ──────────────────────────────────────────────── */}
      <div
        className="grid"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition:       "grid-template-rows 0.28s ease-in-out",
          position:         "relative",
          zIndex:           10,
        }}
      >
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div
            className="px-5 pb-5"
            style={{
              opacity:    open ? 1 : 0,
              transform:  open ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.22s ease, transform 0.22s ease",
            }}
          >
            <SocialNetworkGraph
              agentAddress={agentAddress}
              partners={partners}
              collaboratorsCount={collaboratorsCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
