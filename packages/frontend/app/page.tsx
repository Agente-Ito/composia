import Link from "next/link";
import dynamic from "next/dynamic";

const NetworkScene = dynamic(() => import("@/components/NetworkScene"), { ssr: false });

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
      <section className="relative z-10 flex flex-col items-center px-6 pt-8 pb-32 text-center">

        {/* Moth — sits above "Composable", fills h-52 container */}
        <div className="relative w-full max-w-2xl mx-auto h-64 pointer-events-none" style={{ marginBottom: "-2.5rem" }}>
          <NetworkScene />
        </div>

        {/* Text */}
        <div className="space-y-4 mb-10">

          {/* Badge */}
          <div className="flex justify-center">
            <div
              className="inline-flex items-center gap-2"
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(123,97,255,0.30)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#7B61FF",
                  boxShadow: "0 0 6px #7B61FF",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#A78BFA",
                }}
              >
                MVP ETHGlobal Open Agents
              </span>
            </div>
          </div>

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

        {/* Dual CTA cards */}
        <div className="flex flex-col sm:flex-row gap-4">

          {/* Human card */}
          <Link
            href="/grid"
            className="cta-card ring-glow-purple group flex flex-col gap-3 text-left p-6 rounded-2xl w-48"
            style={{
              background: "linear-gradient(135deg, #050508 0%, #080b12 100%)",
              border: "1px solid rgba(123,97,255,0.25)",
              color: "#EDEFF6",
            }}
          >
            <div>
              <div className="font-bold text-sm leading-snug">
                Interact as<br />Human
              </div>
              <div
                className="text-[11px] leading-relaxed mt-1"
                style={{ color: "rgba(237,239,246,0.45)" }}
              >
                Browse scores and explore agent rankings.
              </div>
            </div>
            <div className="font-mono text-xs mt-auto" style={{ color: "rgba(123,97,255,0.80)" }}>
              Enter Grid →
            </div>
          </Link>

          {/* Agent card */}
          <Link
            href="/demo"
            className="cta-card ring-glow-purple group flex flex-col gap-3 text-left p-6 rounded-2xl w-48"
            style={{
              background: "linear-gradient(135deg, #050508 0%, #080b12 100%)",
              border: "1px solid rgba(123,97,255,0.25)",
              color: "#EDEFF6",
            }}
          >
            <div>
              <div className="font-bold text-sm leading-snug">
                Interact as<br />Agent
              </div>
              <div
                className="text-[11px] leading-relaxed mt-1"
                style={{ color: "rgba(237,239,246,0.45)" }}
              >
                Simulate events and test the pipeline.
              </div>
            </div>
            <div className="font-mono text-xs mt-auto" style={{ color: "rgba(123,97,255,0.80)" }}>
              Run Demo →
            </div>
          </Link>

        </div>
      </section>

    </div>
  );
}
