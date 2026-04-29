"use client";
import { useState } from "react";
import { useWallet } from "@/context/WalletContext";

interface Props {
  agentAddress: string;
  followerCount: number;
  quorum: number;
  isSlashed: boolean;
  isVerified: boolean;
  sepoliaFollowers: string[];
}

type ProposalResult = { ok: boolean; message: string } | null;

export default function GovernancePanel({
  agentAddress,
  followerCount,
  quorum,
  isSlashed,
  isVerified,
  sepoliaFollowers,
}: Props) {
  const { address, connected } = useWallet();
  const [proposing, setProposing]     = useState(false);
  const [result, setResult]           = useState<ProposalResult>(null);

  const isSepFollower = connected && address
    ? sepoliaFollowers.map(a => a.toLowerCase()).includes(address.toLowerCase())
    : false;

  const canProposeSlash   = isSepFollower && isVerified && !isSlashed;
  const canProposeRestore = isSepFollower && isSlashed;
  const quorumPct         = followerCount > 0 ? Math.round((quorum / followerCount) * 100) : 0;

  const handlePropose = async (type: "slash" | "restore") => {
    setProposing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/reputation/${agentAddress}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: type,
          ...(type === "slash" ? { durationSeconds: 86400, reason: "Governance proposal by follower" } : {}),
        }),
      });
      const data = await res.json();
      setResult({
        ok: res.ok,
        message: res.ok
          ? `Proposal submitted — oracle will execute once quorum (${quorum}) is reached.`
          : (data.error ?? "Request failed"),
      });
    } catch {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setProposing(false);
    }
  };

  return (
    <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-[#c8e6ea]">Governance</h2>
        <span className="text-xs text-[#4a6670]">
          Quorum:{" "}
          <span className="text-white font-medium">{quorum}</span>
          {" "}of {followerCount} followers
        </span>
      </div>

      {/* Quorum progress bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00D4FF] rounded-full transition-all"
            style={{ width: `${quorumPct}%` }}
          />
        </div>
        <p className="text-[10px] text-[#4a6670]">
          {quorum} vote{quorum !== 1 ? "s" : ""} needed to pass a proposal
          {followerCount > 0 && ` (50%+1 of ${followerCount} follower${followerCount !== 1 ? "s" : ""})`}
        </p>
      </div>

      {/* Membership status */}
      <div
        className={`text-[11px] rounded-lg border px-3 py-2 ${
          isSepFollower
            ? "bg-[#00FF88]/5 border-[#00FF88]/20 text-[#00FF88]"
            : "bg-composia-dark/40 border-composia-border text-[#4a6670]"
        }`}
      >
        {isSepFollower
          ? "You are a Sepolia follower — you can participate in governance"
          : connected
          ? "Follow on Sepolia (in the Actions section) to participate in governance"
          : "Connect your wallet to participate in governance"}
      </div>

      {/* Active proposals — empty state for now */}
      <div>
        <div className="text-[10px] text-[#4a6670] uppercase tracking-wide mb-2">
          Active Proposals
        </div>
        <div className="text-sm text-[#4a6670] italic border border-dashed border-[#0d1a24] rounded-lg py-5 text-center">
          No active proposals.{" "}
          {followerCount === 0
            ? "Proposals require at least one Sepolia follower."
            : `Requires ${quorum} follower vote${quorum !== 1 ? "s" : ""} to pass.`}
        </div>
      </div>

      {/* Proposal actions — only for Sepolia followers */}
      {isSepFollower && (canProposeSlash || canProposeRestore) && (
        <div className="space-y-2">
          <div className="text-[10px] text-[#4a6670] uppercase tracking-wide">Your Actions</div>
          <div className="flex flex-wrap gap-2">
            {canProposeSlash && (
              <button
                onClick={() => handlePropose("slash")}
                disabled={proposing}
                className="text-xs px-4 py-2 rounded-lg border border-[#FF4060]/30 text-[#FF4060] hover:bg-[#FF4060]/08 transition-colors disabled:opacity-50"
              >
                {proposing ? "Submitting…" : "Propose Slash"}
              </button>
            )}
            {canProposeRestore && (
              <button
                onClick={() => handlePropose("restore")}
                disabled={proposing}
                className="text-xs px-4 py-2 rounded-lg border border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/08 transition-colors disabled:opacity-50"
              >
                {proposing ? "Submitting…" : "Propose Restore"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Proposal result */}
      {result && (
        <p className={`text-xs ${result.ok ? "text-[#00FF88]" : "text-[#FF4060]"}`}>
          {result.message}
        </p>
      )}

      {/* ENS fuses context note */}
      <p className="text-[10px] text-[#4a6670] border-t border-composia-border/40 pt-3">
        Governance is enforced by ENS NameWrapper fuses:{" "}
        <span className="font-mono text-[#c8e6ea]">CANNOT_SET_RESOLVER</span>{" "}
        locks the reputation resolver in place, preventing a slashed agent from bypassing governance.
        On-chain voting replaces oracle execution post-hackathon.
      </p>
    </div>
  );
}
