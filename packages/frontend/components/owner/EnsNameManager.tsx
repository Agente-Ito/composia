"use client";
import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = 11155111;

const ENS_NAME_MANAGER_ABI = [
  "function setCustomName(string calldata label) external",
  "function getPrimaryName(address agent) external view returns (string)",
  "function isLabelAvailable(string calldata label) external view returns (bool)",
];

interface Props {
  agentAddress: string;
}

type CheckState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export default function EnsNameManager({ agentAddress }: Props) {
  const { chainId, getSigner, connected } = useWallet();
  const [primaryName, setPrimaryName]     = useState<string | null>(null);
  const [label, setLabel]                 = useState("");
  const [checkState, setCheckState]       = useState<CheckState>("idle");
  const [checkReason, setCheckReason]     = useState("");
  const [txState, setTxState]             = useState<"idle" | "pending" | "done" | "error">("idle");
  const [txHash, setTxHash]               = useState<string | null>(null);
  const [txError, setTxError]             = useState("");
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameManagerAddr = process.env.NEXT_PUBLIC_ENS_NAME_MANAGER_ADDRESS;
  const configured = !!nameManagerAddr;

  // Fetch current primary name from contract
  useEffect(() => {
    if (!configured || !process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC) return;
    const rpc = process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC;
    const go = async () => {
      try {
        const provider    = new ethers.JsonRpcProvider(rpc);
        const nameManager = new ethers.Contract(nameManagerAddr!, ENS_NAME_MANAGER_ABI, provider);
        const name        = await nameManager.getPrimaryName(agentAddress);
        setPrimaryName(name);
      } catch { /* contract not deployed yet */ }
    };
    go();
  }, [agentAddress, nameManagerAddr, configured]);

  // Debounced availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!label) { setCheckState("idle"); return; }

    debounceRef.current = setTimeout(async () => {
      setCheckState("checking");
      try {
        const res  = await fetch(`/api/ens/check-name?name=${encodeURIComponent(label)}`);
        const data = await res.json();
        if (!data.valid) { setCheckState("invalid"); setCheckReason(data.reason ?? "Invalid"); return; }
        if (data.available === null) { setCheckState("error"); setCheckReason(data.reason ?? "RPC error"); return; }
        setCheckState(data.available ? "available" : "taken");
        setCheckReason("");
      } catch { setCheckState("error"); setCheckReason("Network error"); }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [label]);

  const switchToSepolia = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // 11155111
      });
    } catch (err: unknown) {
      // Chain not added — add it
      if ((err as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }
  };

  const handleSetName = async () => {
    if (checkState !== "available" || !nameManagerAddr) return;
    setTxState("pending");
    setTxError("");
    try {
      const signer     = await getSigner();
      if (!signer) throw new Error("No signer");
      const nameManager = new ethers.Contract(nameManagerAddr, ENS_NAME_MANAGER_ABI, signer);
      const tx          = await nameManager.setCustomName(label);
      setTxHash(tx.hash);
      await tx.wait();
      setPrimaryName(`${label}.composia.eth`);
      setLabel("");
      setCheckState("idle");
      setTxState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxError(msg.length > 120 ? msg.slice(0, 117) + "…" : msg);
      setTxState("error");
    }
  };

  if (!configured) {
    return (
      <div className="text-xs text-gray-500 italic">
        ENS_NAME_MANAGER_ADDRESS not configured — deploy contracts first.
      </div>
    );
  }

  const onWrongChain = connected && chainId !== SEPOLIA_CHAIN_ID;

  return (
    <div className="space-y-4">
      {/* Current name */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Current primary name</div>
        <div className="font-mono text-composia-cyan text-sm">
          {primaryName ?? `${agentAddress.slice(2, 10).toLowerCase()}.composia.eth`}
        </div>
      </div>

      {/* Wrong-chain warning */}
      {onWrongChain && (
        <div className="text-xs text-[#A78BFA] bg-[#1A1C23] border border-[#1A1C23] rounded px-3 py-2 flex items-center justify-between gap-3">
          <span>Switch to Ethereum Sepolia to register a custom name</span>
          <button
            onClick={switchToSepolia}
            className="text-[10px] border border-[#A78BFA]/30 px-2 py-1 rounded hover:bg-[#A78BFA]/10 transition-colors whitespace-nowrap"
          >
            Switch →
          </button>
        </div>
      )}

      {/* Name input */}
      <div className="space-y-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">Set custom name</div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="yourname"
              maxLength={32}
              className="w-full bg-composia-dark border border-composia-border rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-composia-cyan/50 pr-20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-mono">
              .composia.eth
            </span>
          </div>
        </div>

        {/* Availability feedback */}
        {label && (
          <div className={`text-xs px-2 py-1 rounded ${
            checkState === "checking"  ? "text-gray-400" :
            checkState === "available" ? "text-[#A78BFA]" :
            checkState === "taken"     ? "text-red-400" :
            checkState === "invalid"   ? "text-[#A78BFA]" :
            "text-gray-500"
          }`}>
            {checkState === "checking"  && "Checking availability…"}
            {checkState === "available" && `✓ ${label}.composia.eth is available`}
            {checkState === "taken"     && `✗ ${label}.composia.eth is taken`}
            {checkState === "invalid"   && `✗ ${checkReason}`}
            {checkState === "error"     && checkReason}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={onWrongChain ? switchToSepolia : handleSetName}
          disabled={txState === "pending" || (checkState !== "available" && !onWrongChain)}
          className="w-full py-2 rounded-lg text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: checkState === "available" && !onWrongChain ? "rgba(123,97,255,0.1)" : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(123,97,255,0.3)",
            color: "#7B61FF",
          }}
        >
          {txState === "pending"
            ? "Confirming…"
            : onWrongChain
            ? "Switch to Sepolia first"
            : checkState === "available"
            ? `Register ${label}.composia.eth`
            : "Enter an available name"}
        </button>
      </div>

      {/* Tx feedback */}
      {txState === "done" && txHash && (
        <div className="text-xs text-[#00C896] bg-[#00C896]/5 border border-[#00C896]/20 rounded px-3 py-2">
          Name registered!{" "}
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View tx ↗
          </a>
        </div>
      )}
      {txState === "error" && (
        <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2 break-all">
          {txError || "Transaction failed"}
        </div>
      )}

      {/* Info */}
      <div className="text-[10px] text-gray-600 space-y-0.5 pt-1">
        <div>· Custom names require a small amount of ETH on Sepolia for gas</div>
        <div>· Your auto-generated name ({agentAddress.slice(2, 10).toLowerCase()}.composia.eth) stays active</div>
        <div>· Custom name becomes your primary displayed name immediately</div>
      </div>
    </div>
  );
}
