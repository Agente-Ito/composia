"use client";

import { useState } from "react";
import { ethers } from "ethers";
import Link from "next/link";

const UP_ABI = [
  "function acceptOwnership() external",
  "function pendingOwner() external view returns (address)",
  "function owner() external view returns (address)",
];

const ERC8004_REGISTRY_ABI = [
  "function register(string calldata agentURI) external returns (uint256 agentId)",
  "function getAgentId(address agent) external view returns (uint256)",
];

// Sepolia Etherscan link for ERC-8004 registry tx
const explorerSepoliaTx = (h: string) =>
  `https://sepolia.etherscan.io/tx/${h}`;

const REGISTRY_ABI = [
  "function upToAgent(address upAddress) view returns (address)",
  "function agentToKM(address agent) view returns (address)",
];

declare global {
  interface Window { ethereum?: any; }
}

type Phase = "idle" | "connecting" | "checking" | "claiming" | "done" | "registering8004" | "done8004" | "error";

export default function ClaimPage({ params }: { params: { address: string } }) {
  const { address: upAddress } = params;

  const [phase, setPhase]         = useState<Phase>("idle");
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [isPendingOwner, setIsPendingOwner] = useState<boolean | null>(null);
  const [claimTx, setClaimTx]       = useState<string | null>(null);
  const [erc8004Tx, setErc8004Tx]   = useState<string | null>(null);
  const [agentId, setAgentId]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const registryAddress    = process.env.NEXT_PUBLIC_COMPOSIA_REGISTRY_ADDRESS;
  const erc8004Registry    = process.env.NEXT_PUBLIC_ERC8004_REGISTRY_ADDRESS;
  const frontendUrl        = process.env.NEXT_PUBLIC_COMPOSIA_FRONTEND_URL || "https://composia.app";

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

  async function registerERC8004() {
    if (!window.ethereum || !walletAddr || !erc8004Registry) return;
    try {
      setPhase("registering8004");
      setError(null);
      // Switch to Sepolia for the ERC-8004 registration tx
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia
      });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(erc8004Registry, ERC8004_REGISTRY_ABI, signer);
      const agentURI = `${frontendUrl}/api/agent/${walletAddr}/erc8004`;
      const tx = await registry.register(agentURI);
      const receipt = await tx.wait();
      setErc8004Tx(receipt.hash);
      // Parse agentId from Registered event
      const iface = new ethers.Interface(["event Registered(uint256 indexed agentId, string agentURI, address indexed owner)"]);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed) { setAgentId(parsed.args.agentId.toString()); break; }
        } catch { /* skip */ }
      }
      setPhase("done8004");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ERC-8004 registration failed");
      setPhase("done"); // revert to done so they can still navigate away
    }
  }

  const explorerTx  = (h: string) => `https://explorer.execution.testnet.lukso.network/tx/${h}`;
  const explorerUp  = `https://universalprofile.cloud/address/${upAddress}`;
  const isConnected = !!walletAddr;
  const canClaim    = isConnected && isPendingOwner === true && phase !== "done" && phase !== "done8004";

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

      {/* Benefits */}
      <div className="bg-composia-dark/60 border border-composia-border rounded-xl p-4 space-y-3 text-xs">
        <div className="font-medium text-gray-300">What you get when you claim:</div>
        <div className="space-y-1.5">
          {[
            ["✓ Full ownership",              "You control the Universal Profile — assets, metadata, extensions"],
            ["✓ Edit profile",                "Set your display name, description, links, and tags"],
            ["✓ Custom ENS name",             "Register alice.composia.eth instead of the auto-generated hex name"],
            ["✓ Offer services",              "Eligible to list in the Composia marketplace once verified"],
            ["✓ Governance participation",    "Your followers can vote on permissions and endorsements"],
            ["✓ Portable identity",           "Your UP works across Lukso, Ethereum, and any EVM chain"],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-2">
              <span className="text-green-400 shrink-0">{title.split(" ")[0]}</span>
              <div>
                <span className="text-gray-300">{title.slice(2)}</span>
                <span className="text-gray-600 ml-1">— {desc}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-composia-border/50 pt-3">
          <div className="font-medium text-gray-400 mb-1">Composia retains (read-only):</div>
          <p className="text-gray-600">
            <span className="font-mono text-gray-400">SETDATA</span> permission only — to keep syncing{" "}
            <span className="font-mono text-gray-400">gensyn:*</span> reputation data. Cannot move funds or transfer your profile.
          </p>
        </div>
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
        done={phase === "done" || phase === "registering8004" || phase === "done8004"}
        active={isConnected}
      >
        {(phase === "done" || phase === "done8004" || phase === "registering8004") && claimTx ? (
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

      {/* Step 4: Optional ERC-8004 registration */}
      {erc8004Registry && (phase === "done" || phase === "registering8004" || phase === "done8004") && (
        <ClaimStep
          number={4}
          title="Register in ERC-8004 Identity Registry (optional)"
          done={phase === "done8004"}
          active={phase === "done"}
        >
          {phase === "done8004" && erc8004Tx ? (
            <div className="space-y-2">
              <div className="text-green-400 font-medium text-sm">
                Agent registered in ERC-8004 Identity Registry.
              </div>
              {agentId && (
                <div className="text-xs text-gray-400">
                  Agent ID: <span className="font-mono text-white">#{agentId}</span>
                </div>
              )}
              <div className="text-xs space-y-0.5">
                <div className="text-gray-500">
                  TX: <span className="font-mono text-blue-400">{erc8004Tx.slice(0, 18)}...</span>
                </div>
                <a
                  href={explorerSepoliaTx(erc8004Tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-composia-purple hover:underline"
                >
                  View on Sepolia Etherscan ↗
                </a>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Mint your agent as an ERC-8004 identity token (ERC-721) on Ethereum Sepolia.
                This makes your agent discoverable in any ERC-8004 compatible directory.
                Your wallet will be asked to switch to Sepolia (~150k gas).
              </p>
              <div className="text-xs bg-composia-dark/60 rounded-lg p-3 mb-3 space-y-1">
                <div className="text-gray-400 font-medium">What this adds:</div>
                <div className="text-gray-500">• Permanent <span className="font-mono text-gray-300">agentId</span> in a public on-chain registry</div>
                <div className="text-gray-500">• Your profile becomes browsable via <span className="font-mono text-gray-300">tokenURI(agentId)</span></div>
                <div className="text-gray-500">• Compatible with any ERC-8004 reputation aggregator</div>
              </div>
              <button
                onClick={registerERC8004}
                disabled={phase === "registering8004"}
                className="w-full bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {phase === "registering8004" ? "Registering on Sepolia..." : "Register in ERC-8004 (optional)"}
              </button>
              <button
                onClick={() => setPhase("done8004")}
                className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors"
              >
                Skip this step
              </button>
            </>
          )}
        </ClaimStep>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button
            onClick={() => { setError(null); }}
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
