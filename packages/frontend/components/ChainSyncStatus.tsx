"use client";

import { ChainStatus } from "@/lib/types";

interface Props {
  chains: ChainStatus[];
}

const CHAIN_COLORS: Record<number, string> = {
  4201:     "#7B61FF", // LUKSO
  11155111: "#7B61FF", // Ethereum Sepolia
  80001:    "#A78BFA", // Polygon
  421614:   "#A78BFA", // Arbitrum
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
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: CHAIN_COLORS[chain.chainId] ?? "#4A4E62" }}
            />
            <span className="text-sm font-medium">{chain.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {chain.synced ? (
              <>
                <span className="text-gray-400">{chain.accuracy}%</span>
                <span className="flex items-center gap-1 text-[#A78BFA]">
                  <span className="w-2 h-2 rounded-full bg-[#A78BFA] inline-block" />
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
