"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";

const LSP26_ABI = [
  "function follow(address addr) external",
  "function unfollow(address addr) external",
  "function isFollowing(address follower, address addr) external view returns (bool)",
];

interface Props {
  agentAddress: string;
  upAddress: string | null;
}

export default function VisitorActions({ agentAddress, upAddress }: Props) {
  const { address, connected, connect, getSigner } = useWallet();
  const [following, setFollowing]   = useState<boolean | null>(null);
  const [pending,   setPending]     = useState(false);
  const [status,    setStatus]      = useState("");

  const lsp26Addr   = process.env.NEXT_PUBLIC_LSP26_ADDRESS ?? "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA";
  const luksoRpc    = process.env.NEXT_PUBLIC_LUKSO_RPC ?? "https://rpc.testnet.lukso.network";
  const isSelf      = connected && address?.toLowerCase() === agentAddress.toLowerCase();

  // Check current following state
  useEffect(() => {
    if (!connected || !address || !upAddress || isSelf) return;
    const check = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(luksoRpc);
        const lsp26    = new ethers.Contract(lsp26Addr, LSP26_ABI, provider);
        setFollowing(await lsp26.isFollowing(address, upAddress));
      } catch { setFollowing(null); }
    };
    check();
  }, [address, connected, upAddress, lsp26Addr, luksoRpc, isSelf]);

  const toggleFollow = async () => {
    if (!upAddress) { setStatus("No UP address for this agent yet"); return; }
    const signer = await getSigner();
    if (!signer) { await connect(); return; }

    setPending(true);
    setStatus("");
    const optimistic = !following;
    setFollowing(optimistic);

    try {
      const lsp26 = new ethers.Contract(lsp26Addr, LSP26_ABI, signer);
      const tx    = following
        ? await lsp26.unfollow(upAddress)
        : await lsp26.follow(upAddress);
      await tx.wait();
      setStatus(optimistic ? "Following!" : "Unfollowed");
    } catch (err: unknown) {
      setFollowing(!optimistic);
      setStatus(err instanceof Error ? err.message.slice(0, 80) : "Transaction failed");
    } finally {
      setPending(false);
    }
  };

  // Don't show to the agent themselves
  if (isSelf) return null;

  return (
    <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">Actions</h2>

      <div className="flex flex-wrap gap-2">
        {/* Follow / Unfollow */}
        {upAddress && (
          <button
            onClick={connected ? toggleFollow : connect}
            disabled={pending}
            className="text-sm px-4 py-2 rounded-lg border transition-colors disabled:opacity-50"
            style={{
              borderColor: following ? "rgba(0,212,255,0.4)" : "rgba(0,212,255,0.2)",
              color: following ? "#00D4FF" : "#9ca3af",
              background: following ? "rgba(0,212,255,0.08)" : "transparent",
            }}
          >
            {pending
              ? following ? "Unfollowing…" : "Following…"
              : !connected
              ? "Connect to follow"
              : following
              ? "Following ✓"
              : "Follow on Lukso"}
          </button>
        )}

        {/* View on UP Cloud */}
        {upAddress && (
          <a
            href={`https://universalprofile.cloud/address/${upAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-lg border border-composia-border text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            View on Lukso ↗
          </a>
        )}

        {/* Request Service — placeholder */}
        <button
          disabled
          className="text-sm px-4 py-2 rounded-lg border border-composia-border text-gray-600 opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          Request Service
        </button>
      </div>

      {status && (
        <p className="text-xs text-gray-500">{status}</p>
      )}
    </div>
  );
}
