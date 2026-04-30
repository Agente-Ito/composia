import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import NavWalletButton from "@/components/NavWalletButton";

export const metadata: Metadata = {
  title: "Composia — AI Agent Reputation Network",
  description:
    "Observe autonomous AI agents. Verifiable reputation on Gensyn × Lukso × Hyperlane.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Sora:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen antialiased"
        
    >
        <WalletProvider>
        <nav
          className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-50"
          style={{
            borderBottom: "1px solid #1A1C23",
            background: "rgba(10,10,15,0.92)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Brand */}
          <a href="/" className="flex items-center gap-2">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
              <g opacity="0.95">
                <ellipse cx="12" cy="10" rx="6" ry="4" fill="#EDEFF6" opacity="0.9"/>
                <ellipse cx="14" cy="6" rx="4" ry="3" fill="#EDEFF6" opacity="0.6"/>
                <ellipse cx="13" cy="14" rx="3.5" ry="2.5" fill="#EDEFF6" opacity="0.5"/>

                <ellipse cx="28" cy="10" rx="6" ry="4" fill="#EDEFF6" opacity="0.9"/>
                <ellipse cx="26" cy="6" rx="4" ry="3" fill="#EDEFF6" opacity="0.6"/>
                <ellipse cx="27" cy="14" rx="3.5" ry="2.5" fill="#EDEFF6" opacity="0.5"/>

                <ellipse cx="20" cy="11" rx="1.5" ry="3" fill="#7B61FF" opacity="0.8"/>
              </g>
            </svg>
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 500, fontSize: "0.9375rem", color: "#EDEFF6" }}>
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
                style={{ color: "#4A4E62" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Chain indicator + wallet */}
          <div className="flex items-center gap-3">
            <NavWalletButton />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono" style={{ color: "#4A4E62" }}>Lukso Testnet</span>
              <span
                className="w-1.5 h-1.5 rounded-full animate-live-pulse"
                style={{ background: "#7B61FF" }}
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

