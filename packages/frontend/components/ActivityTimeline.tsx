"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import type { MonthActivity } from "@/lib/types";

interface Props {
  data: MonthActivity[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-composia-void border border-composia-border rounded-lg p-3 text-xs space-y-1">
      <div className="font-semibold text-composia-text">{label}</div>
      <div className="text-composia-cyan">Problems: {payload[0]?.value?.toLocaleString()}</div>
      <div className="text-composia-green">Accuracy: {payload[1]?.value}%</div>
    </div>
  );
}

export default function ActivityTimeline({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500">No activity data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0d1a24" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[60, 100]}
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          yAxisId="left"
          dataKey="solved"
          fill="#00D4FF"
          fillOpacity={0.8}
          radius={[3, 3, 0, 0]}
          name="Problems"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="accuracy"
          stroke="#00FF88"
          strokeWidth={2}
          dot={{ fill: "#00FF88", r: 3 }}
          name="Accuracy"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
