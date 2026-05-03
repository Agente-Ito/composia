"use client";

import { useState } from "react";
import Link from "next/link";
import type { Collaborator } from "@/lib/types";

interface Props {
  agentAddress: string;
  partners: Collaborator[];
  collaboratorsCount: number;
}

// All violet — three distinguishable shades
const DOMAIN_COLORS: Record<string, string> = {
  codeReasoning:  "#7B61FF",   // primary violet
  mathReasoning:  "#A78BFA",   // secondary violet
  logicReasoning: "#C4B5FD",   // light lavender
};

const DOMAIN_LABELS: Record<string, string> = {
  codeReasoning:  "Code",
  mathReasoning:  "Math",
  logicReasoning: "Logic",
};

const CX = 200;
const CY = 155;
const ORBIT_R = 110;

// Tiny moth rendered at origin — outer <g> handles positioning
const MOTH_N = [
  { x:  0,  y:  0,  r: 2.0, fill: "white",   o: 0.90 }, // body
  { x: -5,  y: -3,  r: 1.4, fill: "#A78BFA", o: 0.65 }, // left upper wing
  { x: -9,  y:  1,  r: 1.0, fill: "#7B61FF", o: 0.50 }, // left outer
  { x: -3,  y:  3,  r: 0.9, fill: "#A78BFA", o: 0.40 }, // left lower
  { x:  5,  y: -3,  r: 1.4, fill: "#A78BFA", o: 0.65 }, // right upper wing
  { x:  9,  y:  1,  r: 1.0, fill: "#7B61FF", o: 0.50 }, // right outer
  { x:  3,  y:  3,  r: 0.9, fill: "#A78BFA", o: 0.40 }, // right lower
] as const;

const MOTH_E: [number, number][] = [
  [0,1],[0,2],[1,2],[0,3],[1,3],
  [0,4],[0,5],[4,5],[0,6],[4,6],
];

export default function SocialNetworkGraph({ agentAddress, partners, collaboratorsCount }: Props) {
  const [hovered,    setHovered]    = useState<string | null>(null);
  // Moth idles above center; on hover moves to midpoint along the edge
  const [mothTarget, setMothTarget] = useState({ x: CX, y: CY - 38 });

  const maxCollabs = Math.max(...partners.map((p) => p.collaborations), 1);

  return (
    <div className="space-y-4">
      {/* SVG network */}
      <div className="bg-composia-void rounded-xl border border-composia-border overflow-hidden">
        <svg viewBox="0 0 400 310" className="w-full">
          <defs>
            {/* Glow for partner nodes on hover */}
            <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Glow for center node */}
            <filter id="center-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Edges ──────────────────────────────────────────────────────── */}
          {partners.map((partner, i) => {
            const angle = (2 * Math.PI * i) / partners.length - Math.PI / 2;
            const x     = CX + ORBIT_R * Math.cos(angle);
            const y     = CY + ORBIT_R * Math.sin(angle);
            const lineW = 1 + (partner.collaborations / maxCollabs) * 4;
            const color = DOMAIN_COLORS[partner.primaryDomain] ?? "#4A4E62";
            const isHov = hovered === partner.agentAddress;
            return (
              <line
                key={`l${i}`}
                x1={CX} y1={CY}
                x2={x}  y2={y}
                stroke={color}
                strokeWidth={lineW}
                strokeOpacity={hovered ? (isHov ? 0.82 : 0.06) : 0.22}
                style={{ transition: "stroke-opacity 0.22s ease" }}
              />
            );
          })}

          {/* ── Center node — YOU ───────────────────────────────────────────── */}
          <circle cx={CX} cy={CY} r={22} fill="#7B61FF" filter="url(#center-glow)" fillOpacity={0.95} />
          <text x={CX} y={CY - 2}  textAnchor="middle" dominantBaseline="middle" fill="white"   fontSize={8} fontWeight="700">YOU</text>
          <text x={CX} y={CY +  9} textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize={6}>{agentAddress.slice(0, 6)}</text>

          {/* ── Partner nodes ───────────────────────────────────────────────── */}
          {partners.map((partner, i) => {
            const angle = (2 * Math.PI * i) / partners.length - Math.PI / 2;
            const x     = CX + ORBIT_R * Math.cos(angle);
            const y     = CY + ORBIT_R * Math.sin(angle);
            const color = DOMAIN_COLORS[partner.primaryDomain] ?? "#4A4E62";
            const isHov = hovered === partner.agentAddress;
            const r     = 10 + (partner.collaborations / maxCollabs) * 10;

            return (
              <g
                key={`n${i}`}
                onMouseEnter={() => {
                  setHovered(partner.agentAddress);
                  // Move moth to midpoint along the edge — stays off the node itself
                  setMothTarget({ x: (CX + x) / 2, y: (CY + y) / 2 - 14 });
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  setMothTarget({ x: CX, y: CY - 38 });
                }}
                className="cursor-pointer"
                style={{
                  transform:       isHov ? "scale(1.07)" : "scale(1)",
                  transformOrigin: "center",
                  transformBox:    "fill-box",
                  transition:      "transform 0.18s ease-out",
                }}
              >
                <circle
                  cx={x} cy={y} r={r}
                  fill={color}
                  fillOpacity={isHov ? 1 : 0.70}
                  filter={isHov ? "url(#node-glow)" : undefined}
                  style={{ transition: "fill-opacity 0.18s ease" }}
                />
                <text x={x} y={y + r +  9} textAnchor="middle" fill="#9ca3af" fontSize={6.5}>
                  {partner.agentAddress.slice(0, 6)}
                </text>
                <text x={x} y={y + r + 17} textAnchor="middle" fill="#6b7280" fontSize={6}>
                  {partner.collaborations}x
                </text>

                {/* Hover tooltip */}
                {isHov && (
                  <g>
                    <rect x={x - 40} y={y - r - 34} width={80} height={28} rx={4} fill="#050508" stroke="#0d1a24" />
                    <text x={x} y={y - r - 22} textAnchor="middle" fill="white"   fontSize={7} fontWeight="600">
                      {partner.agentAddress.slice(0, 10)}...
                    </text>
                    <text x={x} y={y - r - 12} textAnchor="middle" fill="#9ca3af" fontSize={6}>
                      {partner.avgScore.toFixed(2)} · {DOMAIN_LABELS[partner.primaryDomain]}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ── Moth ────────────────────────────────────────────────────────── */}
          {/* Outer group: CSS translate to target (smooth transition) */}
          <g
            style={{
              transform:   `translate(${mothTarget.x}px, ${mothTarget.y}px)`,
              transition:  "transform 0.42s ease-out",
              opacity:     0.17,
              pointerEvents: "none",
            }}
          >
            {/* Inner group: SVG float animation (independent of position transition) */}
            <g>
              {MOTH_E.map(([a, b], i) => {
                const na = MOTH_N[a], nb = MOTH_N[b];
                return (
                  <line
                    key={i}
                    x1={na.x} y1={na.y}
                    x2={nb.x} y2={nb.y}
                    stroke="white"
                    strokeWidth={0.5}
                    strokeOpacity={0.28}
                  />
                );
              })}
              {MOTH_N.map((n, i) => (
                <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.fill} opacity={n.o} />
              ))}
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 -5; 0 0"
                dur="4.2s"
                repeatCount="indefinite"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs">
        {Object.entries(DOMAIN_COLORS).map(([domain, color]) => (
          <div key={domain} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-gray-400">{DOMAIN_LABELS[domain]}</span>
          </div>
        ))}
        <span className="text-gray-600 ml-auto">
          Showing {partners.length} of {collaboratorsCount} collaborators
        </span>
      </div>

      {/* Collaborator list */}
      <div className="space-y-1.5">
        {partners.map((p, i) => (
          <Link
            key={i}
            href={`/agent/${p.agentAddress}`}
            className="flex items-center justify-between p-2.5 border border-composia-border rounded-lg hover:border-composia-cyan/40 hover:bg-composia-void transition-all"
          >
            <div>
              <div className="font-mono text-xs text-gray-300">
                {p.agentAddress.slice(0, 10)}...{p.agentAddress.slice(-4)}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {p.collaborations} collaborations ·{" "}
                <span style={{ color: DOMAIN_COLORS[p.primaryDomain] ?? "#4A4E62" }}>
                  {DOMAIN_LABELS[p.primaryDomain]}
                </span>
              </div>
            </div>
            <div className="text-sm font-semibold text-[#A78BFA]">
              {p.avgScore.toFixed(2)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
