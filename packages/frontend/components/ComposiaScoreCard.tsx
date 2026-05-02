import type { ComposiaScore } from "@/lib/score";
import { SCORE_WEIGHTS } from "@/lib/score";

interface Props {
  score: ComposiaScore;
  /** Show simplified "compact" view for sidebars / grid tiles */
  compact?: boolean;
}

const COMPONENT_META = [
  {
    key:    "accuracy"    as const,
    label:  "Accuracy",
    weight: SCORE_WEIGHTS.accuracy,
    hint:   "Bayesian-adjusted correctness (needs ≥100 verifications for full confidence)",
  },
  {
    key:    "consistency" as const,
    label:  "Consistency",
    weight: SCORE_WEIGHTS.consistency,
    hint:   "Career utilization rate — how steadily the agent has been working",
  },
  {
    key:    "volume"      as const,
    label:  "Volume",
    weight: SCORE_WEIGHTS.volume,
    hint:   "Log-scale verification count (diminishing returns above 10k)",
  },
  {
    key:    "activity"    as const,
    label:  "Activity",
    weight: SCORE_WEIGHTS.activity,
    hint:   "Exponential decay from last activity — recent agents score higher",
  },
  {
    key:    "network"     as const,
    label:  "Network",
    weight: SCORE_WEIGHTS.network,
    hint:   "LSP26 follower count and endorsement ratio",
  },
];

function tierBgClass(tier: ComposiaScore["tier"]): string {
  switch (tier) {
    case "elite":       return "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30";
    case "trustworthy": return "bg-[#7B61FF]/10 text-[#7B61FF] border-[#7B61FF]/30";
    case "developing":  return "bg-[#FF8C5A]/10 text-[#FF8C5A] border-[#FF8C5A]/30";
    default:            return "bg-[#FF4060]/10 text-[#FF4060] border-[#FF4060]/30";
  }
}

function scoreToBarColor(score: number): string {
  if (score >= 75) return "#A78BFA";
  if (score >= 60) return "#7B61FF";
  if (score >= 40) return "#FF8C5A";
  return "#FF4060";
}

export default function ComposiaScoreCard({ score, compact = false }: Props) {
  const { total, components, tier, tierLabel, tierColor, trendBonus } = score;

  // Big arc progress: map 0-100 to stroke-dashoffset
  // circumference of r=42 circle = 2π×42 ≈ 263.9
  const C = 263.9;
  const offset = C * (1 - total / 100);

  if (compact) {
    return (
      <div className="flex items-center gap-2.5">
        {/* Mini arc */}
        <svg width="40" height="40" viewBox="0 0 100 100" className="shrink-0">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#0d1a24" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke={tierColor}
            strokeWidth="10"
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div>
          <div className="font-sora font-bold text-sm" style={{ color: tierColor }}>{total.toFixed(1)}</div>
          <div className="text-[10px] text-[#4a6670]">Composia Score</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#080b12] border border-[#0d1a24] rounded-xl p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-sora font-bold text-[#c8e6ea] text-base">Composia Score</h2>
          <p className="text-xs text-[#4a6670] mt-0.5">
            Multidimensional reputation — weighted across 5 signals
            {trendBonus && <span className="ml-1.5 text-[#A78BFA]">↑ trend bonus</span>}
          </p>
        </div>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-semibold ${tierBgClass(tier)}`}>
          {tierLabel}
        </span>
      </div>

      {/* Score arc + total */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <svg width="88" height="88" viewBox="0 0 100 100">
            {/* Track */}
            <circle cx="50" cy="50" r="42" fill="none" stroke="#0d1a24" strokeWidth="10" />
            {/* Arc */}
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={tierColor}
              strokeWidth="10"
              strokeDasharray={C}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            {/* Center text */}
            <text
              x="50" y="46"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="18"
              fontWeight="700"
              fontFamily="Sora, sans-serif"
              fill={tierColor}
            >
              {Math.round(total)}
            </text>
            <text
              x="50" y="63"
              textAnchor="middle"
              fontSize="9"
              fill="#4a6670"
              fontFamily="system-ui, sans-serif"
            >
              / 100
            </text>
          </svg>
        </div>

        {/* Full-width main bar */}
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-xs text-[#4a6670]">
            <span>Total</span>
            <span style={{ color: tierColor }}>{total.toFixed(2)}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden bg-[#0d1a24]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${total}%`, background: `linear-gradient(90deg, ${tierColor}aa, ${tierColor})` }}
            />
          </div>
          <p className="text-[11px] text-[#4a6670] leading-snug">
            {tier === "elite"       && "Exceptional track record. High trust for agent collaboration."}
            {tier === "trustworthy" && "Reliable and well-established. Good basis for collaboration."}
            {tier === "developing"  && "Building a track record. Validate before high-stakes work."}
            {tier === "new"         && "Insufficient history. No established reliability signal yet."}
          </p>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-2.5 pt-1">
        <div className="grid grid-cols-[1fr_3rem_1fr_2.5rem] gap-x-2 gap-y-2 items-center text-xs">
          {/* Column headers */}
          <span className="text-[10px] text-[#4a6670] font-semibold uppercase tracking-wider">Component</span>
          <span className="text-[10px] text-[#4a6670] font-semibold uppercase tracking-wider text-right">Score</span>
          <span className="text-[10px] text-[#4a6670] font-semibold uppercase tracking-wider">Progress</span>
          <span className="text-[10px] text-[#4a6670] font-semibold uppercase tracking-wider text-right">Wt.</span>

          {COMPONENT_META.map(({ key, label, weight }) => {
            const val   = components[key];
            const color = scoreToBarColor(val);
            return (
              <>
                <span key={`lbl-${key}`} className="text-[#c8e6ea]" title={
                  COMPONENT_META.find(m => m.key === key)?.hint
                }>{label}</span>

                <span
                  key={`val-${key}`}
                  className="text-right font-mono font-semibold tabular-nums"
                  style={{ color }}
                >
                  {val.toFixed(1)}
                </span>

                <div key={`bar-${key}`} className="h-1.5 rounded-full overflow-hidden bg-[#0d1a24]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${val}%`,
                      background: `linear-gradient(90deg, ${color}55, ${color})`,
                    }}
                  />
                </div>

                <span
                  key={`wt-${key}`}
                  className="text-right text-[10px] text-[#4a6670] tabular-nums"
                >
                  {Math.round(weight * 100)}%
                </span>
              </>
            );
          })}
        </div>
      </div>

      {/* Formula footer */}
      <p className="text-[10px] text-[#4a6670] pt-1 border-t border-[#0d1a24]">
        Score = Accuracy×35% + Consistency×25% + Volume×15% + Activity×15% + Network×10%
      </p>
    </div>
  );
}
