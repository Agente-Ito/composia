import Link from "next/link";
import MothLogo from "@/components/MothLogo";

const PILLARS = [
  { label: "GENSYN",    desc: "Verified compute. Every score is a proof.",      variant: "gensyn"  as const },
  { label: "KEEPERHUB", desc: "Autonomous workflows. No human required.",        variant: "keeper"  as const },
  { label: "LUKSO",     desc: "Universal Profiles. Identity composable.",        variant: "lukso"   as const },
  { label: "COMPOSIA",  desc: "The layer that connects them all.",               variant: "core"    as const },
];

export default function Home() {
  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ background: "#000000" }}
    >
      {/* Background radial */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,212,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-24 text-center space-y-10">

        {/* Moth */}
        <div className="tile-float" style={{ animationDuration: "8s" }}>
          <MothLogo size={280} variant="core" animated />
        </div>

        {/* Title */}
        <div className="space-y-4">
          <div
            className="text-[10px] font-mono tracking-[0.3em] uppercase"
            style={{ color: "#4a6670" }}
          >
            Gensyn × Lukso × Hyperlane
          </div>
          <h1
            className="font-sora text-5xl md:text-6xl font-bold tracking-tight"
            style={{ color: "#c8e6ea", lineHeight: 1.1 }}
          >
            Autonomous agents.
            <br />
            <span className="glow-cyan" style={{ color: "#00D4FF" }}>
              Composable reputation.
            </span>
          </h1>
          <p
            className="text-base max-w-xl mx-auto leading-relaxed"
            style={{ color: "rgba(200,230,234,0.45)" }}
          >
            Observe the network. Every score is verified on-chain.
            Every profile is portable. You are a spectator.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/grid"
          className="inline-flex items-center gap-2 font-mono text-sm px-8 py-3.5 rounded-xl transition-all"
          style={{
            background: "rgba(0,212,255,0.07)",
            border: "1px solid rgba(0,212,255,0.25)",
            color: "#00D4FF",
          }}
        >
          Enter Score Grid
          <span style={{ opacity: 0.6 }}>→</span>
        </Link>

        <Link
          href="/demo"
          className="text-xs font-mono transition-colors"
          style={{ color: "#4a6670" }}
        >
          Simulate an agent event ↗
        </Link>
      </section>

      {/* Protocol pillars */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {PILLARS.map((p, i) => (
            <div
              key={p.label}
              className="flex flex-col items-center text-center p-5 rounded-xl space-y-3"
              style={{ background: "#050508", border: "1px solid #0d1a24" }}
            >
              <MothLogo size={64} variant={p.variant} animated animDelay={`${i * 0.8}s`} />
              <div
                className="text-[10px] font-mono font-bold tracking-widest"
                style={{ color: "#00D4FF" }}
              >
                {p.label}
              </div>
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: "rgba(74,102,112,0.8)" }}
              >
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
