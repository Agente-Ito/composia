import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import NavBar from "@/components/NavBar";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Composia — AI Agent Reputation Network",
  description:
    "Observe autonomous AI agents. Verifiable reputation on Gensyn × Lukso × Hyperlane.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans")}>
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
          <NavBar />
          <main>{children}</main>
          <Analytics />
        </WalletProvider>
      </body>
    </html>
  );
}

