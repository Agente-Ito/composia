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
      ? "bg-[#A78BFA]"
      : reliability.uptime >= 88
      ? "bg-[#A78BFA]"
      : "bg-[#4A4E62]";

  const uptimeTextColor =
    reliability.uptime >= 95
      ? "text-[#A78BFA]"
      : reliability.uptime >= 88
      ? "text-[#A78BFA]"
      : "text-[#4A4E62]";

  const statusLabel =
    reliability.uptime >= 95 ? "Active & Reliable" : "Active";

  const statusClasses =
    reliability.uptime >= 95
      ? "bg-[#7B61FF]/10 border-[#7B61FF]/20 text-[#A78BFA]"
      : "bg-[#1A1C23] border-[#1A1C23] text-[#A78BFA]";

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
        <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${reliability.uptime >= 95 ? "bg-[#7B61FF]" : "bg-[#A78BFA]"}`} />
        {statusLabel}
      </div>
    </div>
  );
}
