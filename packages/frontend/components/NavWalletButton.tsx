"use client";
import { useWallet } from "@/context/WalletContext";

export default function NavWalletButton() {
  const { address, connected, connect, disconnect, error } = useWallet();

  if (connected && address) {
    return (
      <button
        onClick={disconnect}
        title="Click to disconnect"
        className="text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors hover:border-composia-cyan/50"
        style={{
          color: "#7B61FF",
          borderColor: "rgba(123,97,255,0.3)",
          background: "rgba(123,97,255,0.1)",
        }}
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={connect}
        className="text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors hover:border-composia-cyan/50 hover:text-composia-cyan hover:bg-composia-cyan/5"
        style={{ color: "#4a6670", borderColor: "#0d1a24" }}
      >
        Connect
      </button>
      {error && (
        <span className="text-[9px] text-red-400 mt-0.5 max-w-[140px] truncate">
          {error}
        </span>
      )}
    </div>
  );
}
