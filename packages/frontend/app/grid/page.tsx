"use client";

import { useEffect, useState, useCallback } from "react";
import AgentTile, { AgentTileData } from "@/components/AgentTile";
import LiveFeed from "@/components/LiveFeed";
import { MothVariant } from "@/components/MothLogo";
import { previewClaimed, previewSynced } from "@/lib/mock-data";

// ── Static mock agents — always visible even without contracts ────────────────
const MOCK_AGENTS: AgentTileData[] = [
  {
    agentAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    score: 97.4, verifications: 4821, variant: "gensyn",  label: "Agent-7099",
    isGensyn: true, isKeeperActive: true, lastDeposit: "8.2 LYX", floatDelay: "0s",
    claimed: previewClaimed("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    synced:  previewSynced("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
  },
  {
    agentAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    score: 92.7, verifications: 3210, variant: "keeper",  label: "Agent-3C44",
    isGensyn: true, isKeeperActive: true, lastDeposit: "6.1 LYX", floatDelay: "1.1s",
    claimed: previewClaimed("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
    synced:  previewSynced("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
  },
  {
    agentAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    score: 87.4, verifications: 2108, variant: "lukso",   label: "Agent-90F7",
    isGensyn: true, isKeeperActive: false, lastDeposit: "3.7 LYX", floatDelay: "2.2s",
    claimed: previewClaimed("0x90F79bf6EB2c4f870365E785982E1f101E93b906"),
    synced:  previewSynced("0x90F79bf6EB2c4f870365E785982E1f101E93b906"),
  },
  {
    agentAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    score: 95.1, verifications: 5933, variant: "core",    label: "Agent-15D3",
    isGensyn: true, isKeeperActive: true, lastDeposit: "9.4 LYX", floatDelay: "0.7s",
    claimed: previewClaimed("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"),
    synced:  previewSynced("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"),
  },
  {
    agentAddress: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    score: 78.3, verifications: 1402, variant: "gensyn",  label: "Agent-9965",
    isGensyn: false, isKeeperActive: true, lastDeposit: "2.1 LYX", floatDelay: "3.3s",
    claimed: previewClaimed("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"),
    synced:  previewSynced("0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"),
  },
  {
    agentAddress: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    score: 99.0, verifications: 7654, variant: "keeper",  label: "Agent-976E",
    isGensyn: true, isKeeperActive: true, lastDeposit: "14.8 LYX", floatDelay: "1.8s",
    claimed: previewClaimed("0x976EA74026E726554dB657fA54763abd0C3a0aa9"),
    synced:  previewSynced("0x976EA74026E726554dB657fA54763abd0C3a0aa9"),
  },
  {
    agentAddress: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    score: 83.6, verifications: 1987, variant: "lukso",   label: "Agent-14DC",
    isGensyn: true, isKeeperActive: false, lastDeposit: "4.5 LYX", floatDelay: "4.4s",
    claimed: previewClaimed("0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"),
    synced:  previewSynced("0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"),
  },
  {
    agentAddress: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    score: 91.2, verifications: 3301, variant: "core",    label: "Agent-2361",
    isGensyn: true, isKeeperActive: true, lastDeposit: "7.3 LYX", floatDelay: "2.9s",
    claimed: previewClaimed("0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"),
    synced:  previewSynced("0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"),
  },
  {
    agentAddress: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    score: 74.8, verifications: 921,  variant: "gensyn",  label: "Agent-A0EE",
    isGensyn: false, isKeeperActive: false, lastDeposit: undefined, floatDelay: "0.4s",
    claimed: previewClaimed("0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"),
    synced:  previewSynced("0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"),
  },
  {
    agentAddress: "0xBcd4042DE499D14e55001CcbB24a551F3b954096",
    score: 96.6, verifications: 6102, variant: "keeper",  label: "Agent-BCD4",
    isGensyn: true, isKeeperActive: true, lastDeposit: "11.2 LYX", floatDelay: "3.7s",
    claimed: previewClaimed("0xBcd4042DE499D14e55001CcbB24a551F3b954096"),
    synced:  previewSynced("0xBcd4042DE499D14e55001CcbB24a551F3b954096"),
  },
];

type Filter = "all" | "high" | "active";

function variantFromAddress(addr: string): MothVariant {
  const n = parseInt(addr.slice(2, 4), 16) % 4;
  return (["gensyn", "keeper", "lukso", "core"] as MothVariant[])[n];
}

function labelFromAddress(addr: string): string {
  return `Agent-${addr.slice(2, 6).toUpperCase()}`;
}

// Transform an on-chain agent into a tile data object
function apiToTile(agent: {
  agentAddress: string;
  accuracy: number;
  verifications: number;
  synced: boolean;
  upAddress: string | null;
}, index: number): AgentTileData {
  return {
    agentAddress: agent.agentAddress,
    score: agent.accuracy,
    verifications: agent.verifications,
    variant: variantFromAddress(agent.agentAddress),
    label: labelFromAddress(agent.agentAddress),
    isGensyn: agent.accuracy > 0,
    isKeeperActive: agent.verifications > 500,
    lastDeposit: agent.verifications > 200 ? `${(agent.accuracy * 0.1).toFixed(1)} LYX` : undefined,
    claimed: !!agent.upAddress,
    synced: agent.synced,
    floatDelay: `${(index % 6) * 1.1}s`,
  };
}

export default function GridPage() {
  const [tiles, setTiles]       = useState<AgentTileData[]>(MOCK_AGENTS);
  const [filter, setFilter]     = useState<Filter>("all");
  const [lastFetch, setLastFetch] = useState<string>("—");
  const [isLive, setIsLive]     = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) return;
      const data = await res.json() as { agents: {
        agentAddress: string; accuracy: number; verifications: number; synced: boolean; upAddress: string | null;
      }[] };
      if (data.agents?.length) {
        setTiles(data.agents.map((a, i) => apiToTile(a, i)));
      }
      setLastFetch(new Date().toLocaleTimeString("en-US", { hour12: false }));
    } catch {
      // keep mock data on network errors
    }
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchAgents();
    if (!isLive) return;
    const id = setInterval(fetchAgents, 30_000);
    return () => clearInterval(id);
  }, [fetchAgents, isLive]);

  const filtered = tiles.filter((t) => {
    if (filter === "high")   return t.score >= 80;
    if (filter === "active") return t.isGensyn || t.isKeeperActive;
    return true;
  });

  return (
    <div className="grid-bg relative flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Star field background */}
      <div className="star-field" />

      {/* ── Main grid area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">

        {/* Sub-header */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: "1px solid #0d1a24", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-widest text-composia-text uppercase">
              Score Grid
            </h1>
            <span
              className="text-[9px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ color: "#00C896", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.18)" }}
            >
              <span className="animate-live-pulse">●</span> LIVE
            </span>
            <span className="text-[10px] font-mono text-composia-muted">
              {filtered.length} agents
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            {(["all", "high", "active"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-[10px] font-mono px-3 py-1 rounded-lg transition-all"
                style={{
                  background:   filter === f ? "rgba(123,97,255,0.10)" : "transparent",
                  border:       filter === f ? "1px solid rgba(123,97,255,0.30)" : "1px solid transparent",
                  color:        filter === f ? "#A78BFA" : "#4a6670",
                }}
              >
                {f === "all" ? "All" : f === "high" ? "Score > 80" : "Active"}
              </button>
            ))}
          </div>

          <div className="text-[9px] font-mono text-composia-muted">
            last sync {lastFetch}
          </div>
        </div>

        {/* Tiles grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
          >
            {filtered.map((tile, i) => (
              <AgentTile key={tile.agentAddress} data={tile} index={i} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-20 text-composia-muted text-sm font-mono">
                No agents match the current filter.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Live Feed sidebar ───────────────────────────────────────────── */}
      <LiveFeed
        demoInterval={4500}
        className="w-72 shrink-0 z-10"
      />
    </div>
  );
}
