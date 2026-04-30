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
        style={{ background: "#07080E", color: "#DCE0EF" }}
      >
        <WalletProvider>
        <nav
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-50"
          style={{
            borderBottom: "1px solid #1A1C2B",
            background: "rgba(7,8,14,0.92)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Brand */}
          <a href="/" className="flex items-center gap-2.5">
            {/* Composia horizontal mark — geometric butterfly, brand Reference B */}
            <svg viewBox="0 0 38 24" width="38" height="24" aria-hidden="true">
              <defs>
                <filter id="nav-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.2" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {/* Upper-left wing — angular, two-panel */}
              <polygon points="19,12 15,5 4,8 10,14"  fill="#DCE0EF" fillOpacity="0.82" />
              <polygon points="19,12 13,3 4,6 15,5"   fill="#DCE0EF" fillOpacity="0.40" />
              {/* Upper-right wing — mirrored */}
              <polygon points="19,12 23,5 34,8 28,14"  fill="#DCE0EF" fillOpacity="0.82" />
              <polygon points="19,12 25,3 34,6 23,5"   fill="#DCE0EF" fillOpacity="0.40" />
              {/* Lower-left wing */}
              <polygon points="19,12 12,16 7,22 16,17" fill="#DCE0EF" fillOpacity="0.52" />
              {/* Lower-right wing */}
              <polygon points="19,12 26,16 31,22 22,17" fill="#DCE0EF" fillOpacity="0.52" />
              {/* Wing-edge accent lines */}
              <line x1="19" y1="12" x2="4"  y2="8"  stroke="#B8AEF0" strokeWidth="0.5" strokeOpacity="0.5" />
              <line x1="19" y1="12" x2="34" y2="8"  stroke="#B8AEF0" strokeWidth="0.5" strokeOpacity="0.5" />
              <line x1="19" y1="12" x2="7"  y2="22" stroke="#B8AEF0" strokeWidth="0.4" strokeOpacity="0.35" />
              <line x1="19" y1="12" x2="31" y2="22" stroke="#B8AEF0" strokeWidth="0.4" strokeOpacity="0.35" />
              {/* Nucleus */}
              <circle cx="19" cy="12" r="3.2" fill="#8B83F5" fillOpacity="0.18" filter="url(#nav-glow)" />
              <circle cx="19" cy="12" r="2"   fill="#8B83F5" />
            </svg>
            <span className="font-sora text-sm font-semibold tracking-wide" style={{ color: "#DCE0EF" }}>
              Composia
            </span>
          </a>

          {/* Links */}
          <div className="flex items-center gap-1">
            {[
              { href: "/grid",    label: "Grid" },
              { href: "/demo",    label: "Demo" },
              { href: "/keeper",  label: "Keeper" },
              { href: "/agent/0x70997970C51812dc3A010C7d01b50e0d17dc79C8", label: "Profile" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors hover:text-ds-primary hover:bg-ds-primary/5"
                style={{ color: "#505268" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Chain indicator + wallet */}
          <div className="flex items-center gap-3">
            <NavWalletButton />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono" style={{ color: "#505268" }}>Lukso Testnet</span>
              <span
                className="w-1.5 h-1.5 rounded-full animate-live-pulse"
                style={{ background: "#8B83F5" }}
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

