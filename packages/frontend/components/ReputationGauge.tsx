"use client";

interface Props {
  accuracy: number;
  trend: string;
  consistency: "stable" | "rising" | "declining";
}

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getColor(accuracy: number): string {
  if (accuracy >= 90) return "#A78BFA"; // secondary — Excellent
  if (accuracy >= 75) return "#7B61FF"; // primary   — Good
  if (accuracy >= 60) return "#FF8C5A"; // warm      — Average
  return "#FF4060";                     // red       — Low
}

function getLabel(accuracy: number): string {
  if (accuracy >= 90) return "Excellent";
  if (accuracy >= 75) return "Good";
  if (accuracy >= 60) return "Average";
  return "Low";
}

function getConsistencyIcon(c: "stable" | "rising" | "declining"): string {
  if (c === "rising") return "↑";
  if (c === "declining") return "↓";
  return "→";
}

export default function ReputationGauge({ accuracy, trend, consistency }: Props) {
  const color = getColor(accuracy);
  const progress = (accuracy / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
          {/* Track */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="#0d1a24"
            strokeWidth="9"
          />
          {/* Progress glow */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${CIRCUMFERENCE}`}
            filter="url(#glow)"
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease" }}
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-sora font-bold leading-none" style={{ color }}>
            {accuracy}
          </span>
          <span className="text-[10px] text-composia-muted mt-0.5">
            {getLabel(accuracy)}
          </span>
        </div>
      </div>

      {/* Trend + consistency */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
            consistency === "rising"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : consistency === "declining"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-composia-void border-composia-border text-composia-muted"
          }`}
        >
          {getConsistencyIcon(consistency)} {trend}
        </span>
      </div>
      <span className="text-[11px] text-composia-muted">Reputation Score</span>
    </div>
  );
}
