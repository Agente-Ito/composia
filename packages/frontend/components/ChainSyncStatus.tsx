"use client";

import { ChainStatus } from "@/lib/types";

interface Props {
  chains: ChainStatus[];
}

const CHAIN_ICONS: Record<number, string> = {
  4201: "🟪",  // Lukso
  11155111: "⬡", // Ethereum Sepolia
  80001: "🟣",    // Polygon
  421614: "🔵",   // Arbitrum
};

export default function ChainSyncStatus({ chains }: Props) {
  return (
    <div className="space-y-2">
      {chains.map((chain) => (
        <div
          key={chain.chainId}
          className="flex items-center justify-between bg-composia-void rounded-lg px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <span>{CHAIN_ICONS[chain.chainId] ?? "⬡"}</span>
            <span className="text-sm font-medium">{chain.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {chain.synced ? (
              <>
                <span className="text-gray-400">{chain.accuracy}%</span>
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Synced
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />
                Pending
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
