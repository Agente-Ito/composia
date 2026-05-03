import dynamic from "next/dynamic";

const KeeperDashboard = dynamic(() => import("./KeeperDashboard"), { ssr: false });

export const metadata = { title: "Keeper Hub — Composia" };

export default function KeeperPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#c8e6ea]">Keeper Hub</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00C896]/10 text-[#00C896] font-mono tracking-wider">
            LIVE
          </span>
        </div>
        <p className="text-sm text-[#4a6670]">
          Automated keeper execution — monitors Gensyn verifications and provisions Universal Profiles on LUKSO.
        </p>
        <div className="flex gap-4 text-xs text-[#4a6670] mt-1">
          <a
            href="/api/keeperhub/auto-config"
            className="hover:text-[#00C896] transition"
            target="_blank"
            rel="noreferrer"
          >
            Auto-config JSON ↗
          </a>
          <a
            href="https://github.com/keeperhub"
            className="hover:text-[#00C896] transition"
            target="_blank"
            rel="noreferrer"
          >
            KeeperHub docs ↗
          </a>
        </div>
      </div>

      {/* Dashboard (client component with polling) */}
      <KeeperDashboard />
    </main>
  );
}
