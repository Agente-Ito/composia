"use client";

import { useState } from "react";
import { ethers } from "ethers";
import Link from "next/link";

const UP_ABI = [
  "function acceptOwnership() external",
  "function pendingOwner() external view returns (address)",
  "function owner() external view returns (address)",
];

const REGISTRY_ABI = [
  "function upToAgent(address upAddress) view returns (address)",
  "function agentToKM(address agent) view returns (address)",
];

declare global {
  interface Window { ethereum?: any; }
}

type Phase = "idle" | "connecting" | "checking" | "claiming" | "done" | "error";

export default function ClaimPage({ params }: { params: { address: string } }) {
  const { address: upAddress } = params;

  const [phase, setPhase]         = useState<Phase>("idle");
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [isPendingOwner, setIsPendingOwner] = useState<boolean | null>(null);
  const [claimTx, setClaimTx]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const registryAddress = process.env.NEXT_PUBLIC_ATTESTOR_REGISTRY_ADDRESS;

  async function connect() {
    if (!window.ethereum) {
      setError("No wallet detected. Install MetaMask or the Universal Profiles browser extension.");
      setPhase("error");
      return;
    }
    try {
      setPhase("connecting");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setWalletAddr(addr);

      // Check if connected wallet is the pending owner
      setPhase("checking");
      const up = new ethers.Contract(upAddress, UP_ABI, provider);
      try {
        const pending = await up.pendingOwner();
        setIsPendingOwner(pending.toLowerCase() === addr.toLowerCase());
      } catch {
        setIsPendingOwner(null);
      }
      setPhase("idle");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
      setPhase("error");
    }
  }

  async function acceptOwnership() {
    if (!window.ethereum) return;
    try {
      setPhase("claiming");
      setError(null);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const up = new ethers.Contract(upAddress, UP_ABI, signer);
      const tx = await up.acceptOwnership();
      const receipt = await tx.wait();
      setClaimTx(receipt.hash);
      setPhase("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setPhase("error");
    }
  }

  const explorerTx  = (h: string) => `https://explorer.execution.testnet.lukso.network/tx/${h}`;
  const explorerUp  = `https://universalprofile.cloud/address/${upAddress}`;
  const isConnected = !!walletAddr;
  const canClaim    = isConnected && isPendingOwner === true && phase !== "done";

  return (
    <div className="max-w-xl mx-auto px-6 py-12 space-y-6">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← Back
      </Link>

      <div className="space-y-1">
        <h1 className="font-sora text-2xl font-bold text-white">Claim Your Universal Profile</h1>
        <p className="text-gray-400 text-sm">
          Take full ownership of this Composia-managed Universal Profile.
        </p>
      </div>

      {/* UP address card */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-4 space-y-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Universal Profile</div>
        <div className="font-mono text-sm text-composia-purple break-all">{upAddress}</div>
        <a
          href={explorerUp}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:text-composia-purple transition-colors"
        >
          View on UP Cloud ↗
        </a>
      </div>

      {/* Permission explanation */}
      <div className="bg-composia-dark/60 border border-composia-border rounded-xl p-4 space-y-2 text-xs text-gray-400">
        <div className="font-medium text-gray-300">After claiming you control:</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>The Universal Profile — assets, metadata, extensions</li>
          <li>All LSP6 controllers and permissions</li>
          <li>Ability to transfer or sell the profile in future</li>
        </ul>
        <div className="font-medium text-gray-300 mt-3">Composia retains:</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>
            <span className="font-mono text-gray-300">SETDATA</span> permission only — to keep syncing{" "}
            <span className="font-mono text-gray-300">gensyn:*</span> reputation data
          </li>
          <li>Cannot move funds or transfer your profile</li>
        </ul>
      </div>

      {/* Step 1: Connect */}
      <ClaimStep number={1} title="Connect your agent wallet" done={isConnected} active={!isConnected}>
        {isConnected ? (
          <div className="space-y-1">
            <div className="font-mono text-xs text-green-400">{walletAddr}</div>
            {isPendingOwner === true && (
              <div className="text-xs text-green-500">✓ You are the pending owner of this profile</div>
            )}
            {isPendingOwner === false && (
              <div className="text-xs text-red-400">
                This wallet is not the pending owner. Make sure you connected the wallet that received the Gensyn reward for this agent address.
              </div>
            )}
            {isPendingOwner === null && (
              <div className="text-xs text-gray-500">Could not verify pending owner — proceed with caution.</div>
            )}
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={phase === "connecting" || phase === "checking"}
            className="w-full bg-composia-purple hover:bg-composia-purple/90 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {phase === "connecting" ? "Connecting..." : phase === "checking" ? "Checking..." : "Connect Wallet"}
          </button>
        )}
      </ClaimStep>

      {/* Step 2: Already done */}
      <ClaimStep number={2} title="Composia pre-authorized the transfer" done active={false}>
        <p className="text-xs text-gray-500">
          When Composia deployed your profile, it called{" "}
          <span className="font-mono text-gray-300">UP.transferOwnership(you)</span> via the
          KeyManager. Your agent address is already the{" "}
          <span className="text-white">pendingOwner</span> — no action needed from you for this step.
        </p>
      </ClaimStep>

      {/* Step 3: Accept ownership */}
      <ClaimStep
        number={3}
        title="Accept ownership of the Universal Profile"
        done={phase === "done"}
        active={isConnected}
      >
        {phase === "done" && claimTx ? (
          <div className="space-y-2">
            <div className="text-green-400 font-medium text-sm">
              You now own your Universal Profile.
            </div>
            <TxLink hash={claimTx} href={explorerTx(claimTx)} />
            <a
              href={explorerUp}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-composia-purple hover:underline mt-2"
            >
              View your profile on UP Cloud ↗
            </a>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Call <span className="font-mono text-gray-300">acceptOwnership()</span> on the
              Universal Profile. This is the only transaction you pay for (~50k gas).
            </p>
            <button
              onClick={acceptOwnership}
              disabled={!canClaim || phase === "claiming"}
              className="w-full bg-composia-purple hover:bg-composia-purple/90 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {phase === "claiming" ? "Confirming on Lukso..." : "Accept Ownership (1 TX)"}
            </button>
            {!isConnected && (
              <p className="text-xs text-gray-600 text-center mt-2">Connect wallet first</p>
            )}
          </>
        )}
      </ClaimStep>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button
            onClick={() => { setError(null); setPhase(isConnected ? "idle" : "idle"); }}
            className="ml-3 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function ClaimStep({
  number, title, done, active, children,
}: {
  number: number; title: string; done: boolean; active: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`bg-composia-card border rounded-xl p-5 space-y-3 transition-colors ${
      done
        ? "border-green-500/30"
        : active
          ? "border-composia-purple/40"
          : "border-composia-border opacity-60"
    }`}>
      <div className="flex items-center gap-3">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          done
            ? "bg-green-500/20 text-green-400"
            : active
              ? "bg-composia-purple/20 text-composia-purple"
              : "bg-composia-dark text-gray-600"
        }`}>
          {done ? "✓" : number}
        </span>
        <span className={`font-medium text-sm ${
          done ? "text-green-300" : active ? "text-white" : "text-gray-500"
        }`}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function TxLink({ hash, href }: { hash: string; href: string }) {
  return (
    <div className="text-xs space-y-0.5">
      <div className="text-gray-500">
        TX: <span className="font-mono text-blue-400">{hash.slice(0, 18)}...</span>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-composia-purple hover:underline">
        View on Lukso Explorer ↗
      </a>
    </div>
  );
}
