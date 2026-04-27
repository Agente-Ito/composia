import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import NavWalletButton from "@/components/NavWalletButton";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Composia — AI Agent Reputation Network",
  description:
    "Observe autonomous AI agents. Verifiable reputation on Gensyn × Lukso × Hyperlane.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable}`}>
      <body
        className={`${inter.className} min-h-screen antialiased`}
        style={{ background: "#000000", color: "#c8e6ea" }}
      >
        <WalletProvider>
        <nav
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-50"
          style={{
            borderBottom: "1px solid #0d1a24",
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Brand */}
          <a href="/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">
              <g opacity="0.9">
                <polygon points="20,12 8,5 4,14 12,16"   fill="rgba(0,212,255,0.07)" stroke="#00D4FF" strokeWidth="0.6" strokeOpacity="0.55" />
                <polygon points="20,12 32,5 36,14 28,16"  fill="rgba(0,212,255,0.07)" stroke="#00D4FF" strokeWidth="0.6" strokeOpacity="0.55" />
                <polygon points="20,13 10,18 14,22"       fill="rgba(0,212,255,0.04)" stroke="#00D4FF" strokeWidth="0.5" strokeOpacity="0.35" />
                <polygon points="20,13 30,18 26,22"       fill="rgba(0,212,255,0.04)" stroke="#00D4FF" strokeWidth="0.5" strokeOpacity="0.35" />
                <circle cx="20" cy="12" r="2.5" fill="#00D4FF" fillOpacity="0.75" />
                <circle cx="8"  cy="5"  r="1"   fill="#00D4FF" fillOpacity="0.7" />
                <circle cx="32" cy="5"  r="1"   fill="#00D4FF" fillOpacity="0.7" />
                <circle cx="4"  cy="14" r="0.8" fill="#00D4FF" fillOpacity="0.5" />
                <circle cx="36" cy="14" r="0.8" fill="#00D4FF" fillOpacity="0.5" />
              </g>
            </svg>
            <span className="font-sora text-sm font-bold tracking-wider" style={{ color: "#c8e6ea" }}>
              Composia
            </span>
          </a>

          {/* Links */}
          <div className="flex items-center gap-1">
            {[
              { href: "/grid",  label: "Grid" },
              { href: "/demo",  label: "Demo" },
              { href: "/agent/0x70997970C51812dc3A010C7d01b50e0d17dc79C8", label: "Profile" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors hover:text-composia-cyan hover:bg-composia-cyan/5"
                style={{ color: "#4a6670" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Chain indicator + wallet */}
          <div className="flex items-center gap-3">
            <NavWalletButton />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono" style={{ color: "#4a6670" }}>Lukso Testnet</span>
              <span
                className="w-1.5 h-1.5 rounded-full animate-live-pulse"
                style={{ background: "#00FF88" }}
              />
            </div>
          </div>
        </nav>
        <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}

