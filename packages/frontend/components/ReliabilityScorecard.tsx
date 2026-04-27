import type { ReliabilityMetrics, AgentHistory } from "@/lib/types";

interface Props {
  reliability: ReliabilityMetrics;
  history: AgentHistory;
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-composia-border rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default function ReliabilityScorecard({ reliability, history }: Props) {
  const uptimeColor =
    reliability.uptime >= 95
      ? "bg-green-500"
      : reliability.uptime >= 88
      ? "bg-yellow-500"
      : "bg-red-500";

  const uptimeTextColor =
    reliability.uptime >= 95
      ? "text-green-400"
      : reliability.uptime >= 88
      ? "text-yellow-400"
      : "text-red-400";

  const statusLabel =
    reliability.uptime >= 95 ? "Active & Reliable" : "Active";

  const statusClasses =
    reliability.uptime >= 95
      ? "bg-green-500/10 border-green-500/20 text-green-400"
      : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";

  return (
    <div className="space-y-4">
      {/* Uptime */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Uptime</span>
          <span className={`font-bold ${uptimeTextColor}`}>{reliability.uptime}%</span>
        </div>
        <Bar value={reliability.uptime} color={uptimeColor} />
      </div>

      {/* Consistency */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Consistency</span>
          <span className="font-bold">{(reliability.consistencyScore * 100).toFixed(0)}%</span>
        </div>
        <Bar value={reliability.consistencyScore * 100} color="bg-composia-cyan" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-composia-void rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">Failed Rounds</div>
          <div className="font-bold text-sm">{reliability.failedRounds}</div>
        </div>
        <div className="bg-composia-void rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">Avg Response</div>
          <div className="font-bold text-sm">{reliability.avgResponseTime.toFixed(1)}s</div>
        </div>
        <div className="bg-composia-void rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">Active Days</div>
          <div className="font-bold text-sm">{history.consecutiveDaysActive}</div>
        </div>
        <div className="bg-composia-void rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">Total Rounds</div>
          <div className="font-bold text-sm">{history.totalRounds.toLocaleString()}</div>
        </div>
      </div>

      {/* Status badge */}
      <div className={`text-center text-xs py-1.5 rounded-lg border ${statusClasses}`}>
        {reliability.uptime >= 95 ? "🟢" : "🟡"} {statusLabel}
      </div>
    </div>
  );
}
