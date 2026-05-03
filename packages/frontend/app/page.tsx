import Link from "next/link";
import dynamic from "next/dynamic";
import { Building2, Briefcase, Network, TrendingUp } from "lucide-react";

const NetworkScene = dynamic(() => import("@/components/NetworkScene"), { ssr: false });

const USE_CASES = [
  {
    Icon: Building2,
    title: "Vote in DAOs",
    description:
      "Governance weight backed by verified on-chain reputation, not just token balance.",
  },
  {
    Icon: Briefcase,
    title: "Get hired",
    description:
      "Your agent's track record across tasks, chains, and protocols — always portable.",
  },
  {
    Icon: Network,
    title: "Collaborate with agents",
    description:
      "Find and trust other agents at runtime through composable, verifiable identity.",
  },
  {
    Icon: TrendingUp,
    title: "Access DeFi",
    description:
      "Reputation as on-chain signal for better rates and unlocked protocol access.",
  },
] as const;

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: "#0A0A0F" }}>

      {/* Background bloom — tinted toward the animation column */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 68% 38%, rgba(123,97,255,0.08) 0%, transparent 68%)",
        }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col lg:flex-row items-center gap-10 px-8 pt-16 pb-20 w-full max-w-7xl mx-auto min-h-[82vh]">

        {/* Left — copy */}
        <div className="flex flex-col gap-7 lg:w-1/2 lg:pr-10 items-start text-left order-2 lg:order-1">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2"
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(123,97,255,0.28)",
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
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#A78BFA",
              }}
            >
              MVP · ETHGlobal 2026
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(2.4rem, 4.8vw, 3.8rem)",
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "#EDEFF6" }}>Composable reputation<br />layer</span>
            <span style={{ color: "#4A4E62" }}> for agents</span>
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: 16,
              color: "rgba(237,239,246,0.52)",
              lineHeight: 1.72,
              maxWidth: 360,
            }}
          >
            We turn agent reputation into a portable identity usable across any protocol.
          </p>

          <div className="btn-energy-wrapper">
            <Link href="/grid" className="btn-primary">
              View Agents
            </Link>
            <div className="energy-orbs" aria-hidden="true">
              <span className="orb orb-a" />
              <span className="orb orb-b" />
              <span className="orb orb-c" />
            </div>
          </div>

        </div>

        {/* Right — moth animation + 5-step semantic labels */}
        <div className="relative lg:w-1/2 w-full h-72 lg:h-[480px] order-1 lg:order-2">
          <NetworkScene />

          {/*
            5-step narrative cycle (15 s, 3 s per label):
            1. Reputation · Gensyn  — center nucleus area
            2. Identity · LUKSO     — upper-left wing
            3. Discovery · ENS      — left outer wing
            4. Automation · Keeper  — right outer wing
            5. Composable · Composia — lower center
          */}
          <span className="node-label node-label-1" style={{ left: "43%", top: "41%" }}>
            Reputation · Gensyn
          </span>
          <span className="node-label node-label-2" style={{ left: "19%", top: "25%" }}>
            Identity · LUKSO
          </span>
          <span className="node-label node-label-3" style={{ left: "4%", top: "48%" }}>
            Discovery · ENS
          </span>
          <span className="node-label node-label-4" style={{ right: "2%", top: "48%" }}>
            Automation · Keeper
          </span>
          <span className="node-label node-label-5" style={{ left: "34%", top: "69%" }}>
            Composable · Composia
          </span>
        </div>

      </section>

      {/* Section divider */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-8">
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(123,97,255,0.18) 40%, rgba(123,97,255,0.18) 60%, transparent)",
          }}
        />
      </div>

      {/* ── Use cases ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-8 py-20 w-full max-w-7xl mx-auto">

        <h2
          className="text-2xl font-bold mb-10"
          style={{
            color: "#EDEFF6",
            fontFamily: "Space Grotesk, sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          From scattered reputation to a portable identity — your agent can:
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {USE_CASES.map(({ Icon, title, description }) => (
            <div
              key={title}
              className="use-card flex flex-col gap-4 p-5 rounded-2xl"
              style={{
                background: "linear-gradient(160deg, #13141F 0%, #0F1019 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Icon chip */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, rgba(123,97,255,0.18) 0%, rgba(123,97,255,0.07) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 14px rgba(123,97,255,0.09)",
                }}
              >
                <Icon size={18} color="#A78BFA" strokeWidth={1.5} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#EDEFF6",
                    marginBottom: 6,
                    fontFamily: "Space Grotesk, sans-serif",
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: "rgba(237,239,246,0.42)",
                  }}
                >
                  {description}
                </div>
              </div>
            </div>
          ))}
        </div>

      </section>

    </div>
  );
}
