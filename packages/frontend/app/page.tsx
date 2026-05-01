import Link from "next/link";
import MothLogo from "@/components/MothLogo";

const PURPLE = "#7B61FF";

const PILLARS = [
  { label: "GENSYN",    desc: "Verified compute. Every score is a proof.",      variant: "gensyn"  as const },
  { label: "KEEPERHUB", desc: "Autonomous workflows. No human required.",        variant: "keeper"  as const },
  { label: "LUKSO",     desc: "Universal Profiles. Identity composable.",        variant: "lukso"   as const },
  { label: "COMPOSIA",  desc: "The layer that connects them all.",               variant: "core"    as const },
];

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "#0A0A0F" }}>

      {/* Background — subtle purple bloom */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(123,97,255,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-24 text-center">

        {/* Moth — absolute, centered, slightly above text */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="tile-float"
            style={{ animationDuration: "8s", opacity: 0.38, transform: "translateY(-32px)" }}
          >
            <MothLogo size={400} variant="core" animated glowColor={PURPLE} />
          </div>
        </div>

        {/* Content — sits above moth in z-order */}
        <div className="relative z-10 flex flex-col items-center space-y-8">

          {/* Text */}
          <div className="space-y-4">
            <div
              className="text-[10px] font-mono tracking-[0.3em] uppercase"
              style={{ color: "#4A4E62" }}
            >
              Gensyn × Lukso × Hyperlane
            </div>

            <h1
              className="font-sora text-5xl md:text-6xl font-bold tracking-tight"
              style={{ lineHeight: 1.1 }}
            >
              <span style={{ color: "#EDEFF6" }}>
                Composable reputation layer
              </span>
              <br />
              <span style={{ color: "#4A4E62" }}>for agents</span>
            </h1>

            <p
              className="text-base max-w-xl mx-auto leading-relaxed"
              style={{ color: "rgba(237,239,246,0.36)" }}
            >
              Observe the network. Every score is verified on-chain.
              Every profile is portable. You are a spectator.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/grid"
              className="inline-flex items-center gap-2 font-mono text-sm px-8 py-3.5 rounded-xl transition-all hover:opacity-90"
              style={{
                background: "rgba(123,97,255,0.10)",
                border: "1px solid rgba(167,139,250,0.28)",
                color: PURPLE,
              }}
            >
              Enter Score Grid
              <span style={{ opacity: 0.55 }}>→</span>
            </Link>

            <Link
              href="/demo"
              className="text-xs font-mono transition-opacity hover:opacity-80"
              style={{ color: "#4A4E62" }}
            >
              Simulate an agent event ↗
            </Link>
          </div>

        </div>
      </section>

      {/* Protocol pillars */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {PILLARS.map((p, i) => (
            <div
              key={p.label}
              className="flex flex-col items-center text-center p-5 rounded-xl space-y-3"
              style={{ background: "#11121A", border: "1px solid #1A1C23" }}
            >
              <MothLogo
                size={64}
                variant={p.variant}
                animated
                animDelay={`${i * 0.8}s`}
                glowColor={PURPLE}
              />
              <div
                className="text-[10px] font-mono font-bold tracking-widest"
                style={{ color: PURPLE }}
              >
                {p.label}
              </div>
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: "#4A4E62" }}
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
// final UI version