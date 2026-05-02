"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";

interface Props {
  upAddress: string | null;
}

interface AgentEntry {
  agentAddress: string;
  upAddress: string | null;
  score: number;
  following: boolean;
  pending: boolean;
}

const LSP26_ADDRESS =
  process.env.NEXT_PUBLIC_LSP26_ADDRESS ??
  "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA";

const LSP26_ABI = [
  "function follow(address addr) external",
  "function unfollow(address addr) external",
  "function followerCount(address addr) view returns (uint256)",
  "function followingCount(address addr) view returns (uint256)",
  "function isFollowing(address follower, address addr) view returns (bool)",
];

const KM_ABI = [
  "function execute(bytes calldata payload) external returns (bytes memory)",
];

type Filter = "all" | "following" | "top";

export default function FollowAgents({ upAddress }: Props) {
  const { getSigner } = useWallet();
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const rpc =
        process.env.NEXT_PUBLIC_LUKSO_RPC ?? "https://rpc.testnet.lukso.network";
      const provider = new ethers.JsonRpcProvider(rpc);
      const lsp26 = new ethers.Contract(LSP26_ADDRESS, LSP26_ABI, provider);

      // Fetch agents list from API
      const res = await fetch("/api/agents").catch(() => null);
      const data = res?.ok ? await res.json() : { agents: [] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = data.agents ?? [];

      // Stats for current UP
      if (upAddress) {
        try {
          const [fc, fwc] = await Promise.all([
            lsp26.followerCount(upAddress),
            lsp26.followingCount(upAddress),
          ]);
          setFollowerCount(Number(fc));
          setFollowingCount(Number(fwc));
        } catch { /* no LSP26 contract on testnet */ }
      }

      const entries: AgentEntry[] = await Promise.all(
        raw
          .filter((a: { upAddress?: string; agentAddress?: string }) => !!a.upAddress && !!a.agentAddress)
          .map(async (a: { agentAddress: string; upAddress: string; accuracy?: number }) => {
            let following = false;
            if (upAddress) {
              try {
                following = await lsp26.isFollowing(upAddress, a.upAddress);
              } catch { /* ignore */ }
            }
            return {
              agentAddress: a.agentAddress,
              upAddress: a.upAddress,
              score: a.accuracy ?? 0,
              following,
              pending: false,
            };
          })
      );
      setAgents(entries);
    } catch (err) {
      console.error("FollowAgents load error:", err);
    } finally {
      setLoading(false);
    }
  }, [upAddress]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const toggleFollow = async (target: AgentEntry) => {
    if (!upAddress) { setStatus("No UP address found."); return; }
    // Optimistic update
    setAgents((prev) =>
      prev.map((a) =>
        a.agentAddress === target.agentAddress ? { ...a, pending: true } : a
      )
    );
    setStatus(null);
    try {
      const signer = await getSigner();
      if (!signer) throw new Error("Wallet not connected");

      const lsp26 = new ethers.Contract(LSP26_ADDRESS, LSP26_ABI, signer);
      if (target.following) {
        const tx = await lsp26.unfollow(target.upAddress!);
        await tx.wait();
      } else {
        const tx = await lsp26.follow(target.upAddress!);
        await tx.wait();
      }
      setAgents((prev) =>
        prev.map((a) =>
          a.agentAddress === target.agentAddress
            ? { ...a, following: !a.following, pending: false }
            : a
        )
      );
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
      // Revert optimistic update
      setAgents((prev) =>
        prev.map((a) =>
          a.agentAddress === target.agentAddress ? { ...a, pending: false } : a
        )
      );
    }
  };

  const filtered = agents.filter((a) => {
    if (filter === "following") return a.following;
    if (filter === "top") return a.score >= 90;
    return true;
  }).filter((a) => !!a.agentAddress);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "following", label: "Following" },
    { id: "top", label: "Score ≥ 90" },
  ];

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-xs" style={{ color: "#4a6670" }}>
        Follow other Gensyn agents from your Universal Profile via LSP26.
      </p>

      {/* Stats row */}
      {upAddress && (
        <div className="flex gap-4">
          {[
            { label: "Followers", val: followerCount },
            { label: "Following", val: followingCount },
          ].map(({ label, val }) => (
            <div
              key={label}
              className="rounded-lg px-4 py-2 text-center"
              style={{ background: "#080b12", border: "1px solid #0d1a24" }}
            >
              <div className="font-bold text-sm" style={{ color: "#c8e6ea" }}>
                {val ?? "—"}
              </div>
              <div className="text-[10px]" style={{ color: "#4a6670" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="text-[10px] font-mono px-3 py-1 rounded-lg transition-colors"
            style={{
              background: filter === f.id ? " "rgba(123,97,255,$($args[0].Groups[1].Value))" " : "transparent",
              color: filter === f.id ? "#7B61FF" : "#4a6670",
              border: `1px solid ${filter === f.id ? " "rgba(123,97,255,$($args[0].Groups[1].Value))" " : "#0d1a24"}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="text-xs animate-pulse" style={{ color: "#4a6670" }}>
          Loading agents…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-xs" style={{ color: "#4a6670" }}>
          No agents found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((agent) => (
            <div key={agent.agentAddress}
              className="rounded-lg p-3 flex items-center justify-between gap-3"
              style={{ background: "#080b12", border: "1px solid #0d1a24" }}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="font-mono text-xs truncate" style={{ color: "#c8e6ea" }}>
                  {agent.agentAddress.slice(0, 10)}…{agent.agentAddress.slice(-6)}
                </div>
                <div className="text-[10px]" style={{ color: "#4a6670" }}>
                  Score:{" "}
                  <span
                    style={{
                      color:
                        agent.score >= 90
                          ? "#A78BFA"
                          : agent.score >= 75
                          ? "#7B61FF"
                          : agent.score >= 60
                          ? "#A78BFA"
                          : "#FF4060",
                    }}
                  >
                    {agent.score}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => toggleFollow(agent)}
                disabled={agent.pending}
                className="shrink-0 text-[10px] font-mono px-3 py-1 rounded-lg border transition-colors disabled:opacity-50"
                style={{
                  borderColor: agent.following
                    ? " "rgba(167,139,250,$($args[0].Groups[1].Value))" "
                    : "#0d1a24",
                  color: agent.following ? "#A78BFA" : "#4a6670",
                  background: agent.following
                    ? " "rgba(167,139,250,$($args[0].Groups[1].Value))" "
                    : "transparent",
                }}
              >
                {agent.pending ? "…" : agent.following ? "Following ✓" : "Follow"}
              </button>
            </div>
          ))}
        </div>
      )}

      {status && (
        <p className="text-xs" style={{ color: "#FF4060" }}>
          {status}
        </p>
      )}
    </div>
  );
}
