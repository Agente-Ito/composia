import Link from "next/link";
import dynamic from "next/dynamic";
import MothLogo from "@/components/MothLogo";

const NetworkScene = dynamic(() => import("@/components/NetworkScene"), { ssr: false });

const PURPLE = "#7B61FF";

const PILLARS = [
  { label: "GENSYN",    desc: "Verified compute. Every score is a proof.",         variant: "gensyn"  as const, color: "#FF4F8B" },
  { label: "KEEPERHUB", desc: "Autonomous workflows. No human required.",           variant: "keeper"  as const, color: "#00C896" },
  { label: "ENS",       desc: "Human-readable names, portable across chains.",      variant: "ens"     as const, color: "#5298FF" },
  { label: "LUKSO",     desc: "Universal Profiles. Identity composable.",           variant: "lukso"   as const, color: "#7B61FF" },
  { label: "COMPOSIA",  desc: "The layer that connects them all.",                  variant: "core"    as const, color: "#A78BFA" },
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
      <div className="relative">

        {/* NetworkMoth — shifted up so body sits above the title */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <NetworkScene />
        </div>

        <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-48 pb-32 text-center">

          {/* Text */}
          <div className="space-y-4 mb-8">
            <h1
              className="text-5xl md:text-6xl font-bold"
              style={{ lineHeight: 1.08 }}
            >
              <span style={{ color: "#EDEFF6" }}>
                Composable reputation layer
              </span>
              <br />
              <span style={{ color: "#4A4E62" }}>for agents</span>
            </h1>

            <p
              className="text-base max-w-xl mx-auto leading-relaxed"
              style={{ color: "rgba(237,239,246,0.45)" }}
            >
              Composia turns verifiable behavior into portable identity.
              Reputation that moves with agents, across every chain.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/grid"
              className="cta-primary inline-flex items-center gap-2.5 font-mono text-sm font-semibold px-10 py-4 rounded-xl transition-all"
              style={{
                background: PURPLE,
                color: "#EDEFF6",
                boxShadow: "0 0 0 0 rgba(123,97,255,0)",
              }}
            >
              Enter Score Grid
              <span className="text-base" style={{ opacity: 0.75 }}>→</span>
            </Link>

            <Link
              href="/demo"
              className="text-xs font-mono transition-opacity hover:opacity-80"
              style={{ color: "#4A4E62" }}
            >
              Simulate an agent event ↗
            </Link>
          </div>
        </section>
      </div>

      {/* Protocol pillars */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-3">
          {PILLARS.map((p, i) => (
            <div
              key={p.label}
              className="pillar-card flex flex-col items-center text-center p-5 rounded-xl space-y-3"
              style={{
                background: "#11121A",
                border: `1px solid ${p.color}22`,
              }}
            >
              <MothLogo
                size={64}
                variant={p.variant}
                animated
                animDelay={`${i * 0.8}s`}
                glowColor={p.color}
              />
              <div
                className="text-[10px] font-mono font-bold tracking-widest"
                style={{ color: p.color }}
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
