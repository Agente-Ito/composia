import { ComposiaLogo } from "@/components/ComposiaLogo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import MothLogo from "@/components/MothLogo";

// ── Static data ──────────────────────────────────────────────────────────────

const ATTESTATIONS = [
  { label: "Inference task completed",   delta: "+2.1", chain: "ARB", time: "2m ago"  },
  { label: "Safety validation passed",   delta: "+1.4", chain: "ETH", time: "5m ago"  },
  { label: "Task delegation successful", delta: "+0.8", chain: "OP",  time: "11m ago" },
] as const;

const CAPABILITIES = [
  { label: "Reliability", value: 94 },
  { label: "Speed",       value: 87 },
  { label: "Trust",       value: 91 },
  { label: "Uptime",      value: 98 },
] as const;

const CHAINS = ["ETH", "ARB", "BASE", "OP", "POLYGON"] as const;

const STATS = [
  { value: "12,847", label: "Active Agents"  },
  { value: "2.4M",   label: "Attestations"   },
  { value: "7",      label: "Networks"       },
] as const;

// ── Sparkline ────────────────────────────────────────────────────────────────

function AgentSparkline() {
  const raw = [72, 68, 75, 70, 78, 74, 82, 79, 86, 88, 91, 94];
  const w = 100;
  const h = 28;
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const pts = raw
    .map((v, i) => {
      const x = (i / (raw.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const [x0] = pts.split(" ")[0].split(",");
  const [xN] = pts.split(" ").slice(-1)[0].split(",");
  const area = `${x0},${h} ${pts} ${xN},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 28 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ag-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7B61FF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7B61FF" stopOpacity="0"    />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#ag-spark)" />
      <polyline points={pts} fill="none" stroke="#7B61FF" strokeWidth="1.3"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-ds-bg text-ds-text">
      <div className="mx-auto max-w-5xl px-6 py-16 lg:grid lg:grid-cols-[1fr_368px] lg:gap-16">

        {/* ── Left: Hero ──────────────────────────────────────────────────── */}
        <section className="relative flex flex-col justify-center pb-20 lg:pb-0 lg:sticky lg:top-24 lg:self-start overflow-hidden">

          {/* Moth network — absolute, behind all content */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="tile-float"
              style={{ opacity: 0.44, animationDuration: "8s", transform: "translateY(-24px)" }}
            >
              <MothLogo size={520} variant="core" animated glowColor="#7B61FF" />
            </div>
          </div>

          {/* All content sits above the moth */}
          <div className="relative z-10 flex flex-col space-y-10">

          {/* wordmark */}
          <div className="flex items-center gap-2.5">
            <ComposiaLogo size={30} />
            <span className="text-[11px] font-mono tracking-widest uppercase text-ds-muted">
              Composia
            </span>
          </div>

          {/* headline */}
          <div className="space-y-5">
            <h1 className="font-sora text-6xl md:text-7xl font-semibold leading-[1.05] tracking-[-0.02em]">
              <span className="block">Composable</span>
              <span className="block">
                reputation{" "}
                <span
                  className="text-ds-primary"
                  style={{ textShadow: "0 0 28px rgba(123,97,255,0.55), 0 0 60px rgba(123,97,255,0.20)" }}
                >layer</span>
              </span>
              <span className="block text-ds-text/70">for agents.</span>
            </h1>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-ds-muted/90">
              Composia turns verifiable behavior into portable identity —
              reputation that moves with agents across every network.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <Button variant="primary">Get Early Access</Button>
            <Button variant="secondary">Read the Docs</Button>
          </div>

          {/* stats */}
          <div className="flex items-center gap-10 border-t border-ds-line pt-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-sora text-2xl font-semibold text-ds-text tabular-nums">
                  {s.value}
                </p>
                <p className="text-[11px] text-ds-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          </div>{/* end z-10 content wrapper */}
        </section>

        {/* ── Right: Product Cards ─────────────────────────────────────────── */}
        <aside className="space-y-2.5">

          {/* Agent Identity */}
          <Card>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-ds-muted mb-1.5">
                  Agent
                </p>
                <code className="text-sm text-ds-text/75 font-mono">0x4f3e…7a91</code>
              </div>
              <Badge variant="active">Active</Badge>
            </div>

            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-ds-muted mb-2">
                  Reputation Score
                </p>
                <div className="flex items-baseline gap-2.5">
                  <span className="font-sora text-[52px] font-bold leading-none text-ds-text tabular-nums">
                    94.2
                  </span>
                  <span className="text-sm font-medium text-ds-secondary">↑ 8.3%</span>
                </div>
              </div>
              <span className="text-xs text-ds-muted mb-1">30d</span>
            </div>

            <AgentSparkline />
          </Card>

          {/* Activity Feed */}
          <Card>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ds-muted mb-4">
              Recent Attestations
            </p>
            <div className="divide-y divide-ds-line">
              {ATTESTATIONS.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-primary/60" />
                    <span className="text-sm text-ds-text truncate">{a.label}</span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                    <span className="text-sm font-mono font-medium text-ds-secondary">{a.delta}</span>
                    <span className="text-[10px] font-mono text-ds-muted bg-ds-elev px-1.5 py-0.5 rounded">
                      {a.chain}
                    </span>
                    <span className="text-xs text-ds-muted w-12 text-right">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Capability Profile */}
          <Card>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ds-muted mb-4">
              Capability Profile
            </p>
            <div className="space-y-3.5">
              {CAPABILITIES.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-ds-text">{c.label}</span>
                    <span className="text-sm font-mono text-ds-muted tabular-nums">{c.value}</span>
                  </div>
                  <div className="h-[3px] w-full rounded-full bg-ds-line">
                    <div
                      className="h-full rounded-full bg-ds-primary"
                      style={{ width: `${c.value}%`, opacity: 0.55 + (c.value / 100) * 0.45 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Portable Identity */}
          <Card>
            <p className="text-[10px] font-mono uppercase tracking-widest text-ds-muted mb-4">
              Portable Identity
            </p>
            <div className="flex flex-wrap gap-2">
              {CHAINS.map((chain) => (
                <div
                  key={chain}
                  className="flex items-center gap-1.5 rounded-md border border-ds-line bg-ds-elev px-2.5 py-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-ds-primary/50" />
                  <span className="text-[11px] font-mono text-ds-text/60">{chain}</span>
                </div>
              ))}
            </div>
          </Card>

        </aside>
      </div>
    </div>
  );
}
