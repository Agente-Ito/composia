"use client";

import { useState } from "react";
import Link from "next/link";
import type { Collaborator } from "@/lib/types";

interface Props {
  agentAddress: string;
  partners: Collaborator[];
  collaboratorsCount: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  codeReasoning: "#10b981",
  mathReasoning: "#f59e0b",
  logicReasoning: "#8b5cf6",
};

const DOMAIN_LABELS: Record<string, string> = {
  codeReasoning: "Code",
  mathReasoning: "Math",
  logicReasoning: "Logic",
};

const CX = 200;
const CY = 155;
const ORBIT_R = 110;

export default function SocialNetworkGraph({ agentAddress, partners, collaboratorsCount }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxCollabs = Math.max(...partners.map((p) => p.collaborations), 1);

  return (
    <div className="space-y-4">
      {/* SVG network */}
      <div className="bg-composia-void rounded-xl border border-composia-border overflow-hidden">
        <svg viewBox="0 0 400 310" className="w-full">
          {/* Connection lines */}
          {partners.map((partner, i) => {
            const angle = (2 * Math.PI * i) / partners.length - Math.PI / 2;
            const x = CX + ORBIT_R * Math.cos(angle);
            const y = CY + ORBIT_R * Math.sin(angle);
            const lineW = 1 + (partner.collaborations / maxCollabs) * 4;
            const color = DOMAIN_COLORS[partner.primaryDomain] ?? "#6b7280";
            const isHov = hovered === partner.agentAddress;
            return (
              <line
                key={`l${i}`}
                x1={CX} y1={CY}
                x2={x} y2={y}
                stroke={color}
                strokeWidth={lineW}
                strokeOpacity={isHov ? 0.7 : 0.25}
                style={{ transition: "stroke-opacity 0.2s" }}
              />
            );
          })}

          {/* Center node — YOU */}
          <circle cx={CX} cy={CY} r={22} fill="#00D4FF" />
          <text
            x={CX} y={CY - 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={8}
            fontWeight="700"
          >
            YOU
          </text>
          <text
            x={CX} y={CY + 9}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#c8e6ea"
            fontSize={6}
          >
            {agentAddress.slice(0, 6)}
          </text>

          {/* Partner nodes */}
          {partners.map((partner, i) => {
            const angle = (2 * Math.PI * i) / partners.length - Math.PI / 2;
            const x = CX + ORBIT_R * Math.cos(angle);
            const y = CY + ORBIT_R * Math.sin(angle);
            const color = DOMAIN_COLORS[partner.primaryDomain] ?? "#6b7280";
            const isHov = hovered === partner.agentAddress;
            const r = 10 + (partner.collaborations / maxCollabs) * 10;

            return (
              <g
                key={`n${i}`}
                onMouseEnter={() => setHovered(partner.agentAddress)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={x} cy={y}
                  r={r + (isHov ? 3 : 0)}
                  fill={color}
                  fillOpacity={isHov ? 1 : 0.75}
                  style={{ transition: "r 0.15s, fill-opacity 0.15s" }}
                />
                <text
                  x={x}
                  y={y + r + 9}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize={6.5}
                >
                  {partner.agentAddress.slice(0, 6)}
                </text>
                <text
                  x={x}
                  y={y + r + 17}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize={6}
                >
                  {partner.collaborations}x
                </text>
                {/* Hover tooltip */}
                {isHov && (
                  <g>
                    <rect
                      x={x - 40} y={y - r - 34}
                      width={80} height={28}
                      rx={4}
                      fill="#050508"
                      stroke="#0d1a24"
                    />
                    <text x={x} y={y - r - 22} textAnchor="middle" fill="white" fontSize={7} fontWeight="600">
                      {partner.agentAddress.slice(0, 10)}...
                    </text>
                    <text x={x} y={y - r - 12} textAnchor="middle" fill="#9ca3af" fontSize={6}>
                      ⭐ {partner.avgScore.toFixed(2)} · {DOMAIN_LABELS[partner.primaryDomain]}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
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

      {/* Top collaborators list */}
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
                <span style={{ color: DOMAIN_COLORS[p.primaryDomain] }}>
                  {DOMAIN_LABELS[p.primaryDomain]}
                </span>
              </div>
            </div>
            <div className="text-sm font-semibold text-yellow-400">
              ⭐ {p.avgScore.toFixed(2)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
