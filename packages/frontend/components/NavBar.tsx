"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import ComposiaLogoHorizontal from "@/components/ComposiaLogoHorizontal";
import NavWalletButton from "@/components/NavWalletButton";

const NAV_LINKS = [
  { href: "/grid", label: "View Agents" },
  { href: "/demo", label: "Demo" },
] as const;

function getBasePath(href: string) {
  if (href.startsWith("/agent/")) return "/agent";
  return href;
}

export default function NavBar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`nav-bar${scrolled ? " nav-bar--scrolled" : ""} flex items-center justify-between px-6 py-3.5 sticky top-0 z-50`}
    >
      <Link href="/" className="flex items-center">
        <ComposiaLogoHorizontal />
      </Link>

      <div className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const base = getBasePath(link.href);
          const isActive =
            pathname === link.href ||
            (base.length > 1 && pathname.startsWith(base + "/"));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link font-mono${isActive ? " nav-link-active" : ""}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <NavWalletButton />
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono" style={{ color: "#4A4E62" }}>
            Lukso Testnet
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full animate-live-pulse"
            style={{ background: "#7B61FF" }}
          />
        </div>
      </div>
    </nav>
  );
}
