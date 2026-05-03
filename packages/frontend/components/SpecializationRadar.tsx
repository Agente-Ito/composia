"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Specialization } from "@/lib/types";

interface Props {
  domains: Specialization["domains"];
}

const DOMAIN_LABELS: Record<string, string> = {
  codeReasoning: "Code",
  mathReasoning: "Math",
  logicReasoning: "Logic",
};

export default function SpecializationRadar({ domains }: Props) {
  const data = [
    {
      subject: "Code",
      Accuracy: domains.codeReasoning.accuracy,
      "Peer Score": Math.round(domains.codeReasoning.avgPeerScore * 100),
      fullMark: 100,
    },
    {
      subject: "Math",
      Accuracy: domains.mathReasoning.accuracy,
      "Peer Score": Math.round(domains.mathReasoning.avgPeerScore * 100),
      fullMark: 100,
    },
    {
      subject: "Logic",
      Accuracy: domains.logicReasoning.accuracy,
      "Peer Score": Math.round(domains.logicReasoning.avgPeerScore * 100),
      fullMark: 100,
    },
  ];

  const domainList = [
    { key: "codeReasoning", stats: domains.codeReasoning },
    { key: "mathReasoning", stats: domains.mathReasoning },
    { key: "logicReasoning", stats: domains.logicReasoning },
  ];

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={data}>
          <PolarGrid stroke="#0d1a24" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Accuracy"
            dataKey="Accuracy"
            stroke="#7B61FF"
            fill="#7B61FF"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name="Peer Score"
            dataKey="Peer Score"
            stroke="#A78BFA"
            fill="#A78BFA"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <Tooltip
            contentStyle={{
              background: "#050508",
              border: "1px solid #0d1a24",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`${value}%`, name]}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Domain detail rows */}
      <div className="space-y-1.5">
        {domainList.map(({ key, stats }) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-gray-400 w-10">{DOMAIN_LABELS[key]}</span>
            <div className="flex-1 mx-2 bg-composia-border rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-composia-cyan"
                style={{ width: `${stats.accuracy}%` }}
              />
            </div>
            <span className="font-medium w-8 text-right">{stats.accuracy}%</span>
            <span
              className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                stats.expertise === "High"
                  ? "bg-[#7B61FF]/20 text-[#A78BFA]"
                  : stats.expertise === "Medium"
                  ? "bg-[#A78BFA]/20 text-[#A78BFA]"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {stats.expertise}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
