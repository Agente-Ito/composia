"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";

const LSP26_ABI = [
  "function follow(address addr) external",
  "function unfollow(address addr) external",
  "function isFollowing(address follower, address addr) external view returns (bool)",
];

const REP_STATE_ABI = [
  "function addFollower(bytes32 node, address follower) external",
  "function removeFollower(bytes32 node) external",
  "function settleSlash(bytes32 node) external",
];

const SEPOLIA_CHAIN_ID = 11155111;

interface Props {
  agentAddress: string;
  upAddress: string | null;
  isSlashed: boolean;
  slashExpired: boolean;
  sepoliaFollowers: string[];
}

export default function VisitorActions({
  agentAddress,
  upAddress,
  isSlashed,
  slashExpired,
  sepoliaFollowers,
}: Props) {
  const { address, connected, chainId, connect, getSigner } = useWallet();

  const [following, setFollowing]           = useState<boolean | null>(null);
  const [pending, setPending]               = useState(false);
  const [sepoliaPending, setSepoliaPending] = useState(false);
  const [settlingSlash, setSettlingSlash]   = useState(false);
  const [status, setStatus]                 = useState("");

  const lsp26Addr    = process.env.NEXT_PUBLIC_LSP26_ADDRESS ?? "0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA";
  const luksoRpc     = process.env.NEXT_PUBLIC_LUKSO_RPC ?? "https://rpc.testnet.lukso.network";
  const sepoliaRpc   = process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const repStateAddr = process.env.NEXT_PUBLIC_REPUTATION_STATE_ADDRESS;

  const isSelf        = connected && address?.toLowerCase() === agentAddress.toLowerCase();
  const isSepFollower = connected && address
    ? sepoliaFollowers.map(a => a.toLowerCase()).includes(address.toLowerCase())
    : false;

  const agentNode = (() => {
    try {
      const label = agentAddress.slice(2, 10).toLowerCase();
      return ethers.namehash(`${label}.composia.eth`);
    } catch { return null; }
  })();

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

  const switchToSepolia = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [sepoliaRpc],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }
  };

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
      setStatus(optimistic ? "Following on Lukso!" : "Unfollowed on Lukso");
    } catch (err: unknown) {
      setFollowing(!optimistic);
      setStatus(err instanceof Error ? err.message.slice(0, 80) : "Transaction failed");
    } finally {
      setPending(false);
    }
  };

  const toggleSepoliaFollow = async () => {
    if (!repStateAddr || !agentNode) { setStatus("Reputation contract not configured"); return; }
    const signer = await getSigner();
    if (!signer) { await connect(); return; }
    if (chainId !== SEPOLIA_CHAIN_ID) { await switchToSepolia(); return; }

    setSepoliaPending(true);
    setStatus("");
    try {
      const repState = new ethers.Contract(repStateAddr, REP_STATE_ABI, signer);
      const tx = isSepFollower
        ? await repState.removeFollower(agentNode)
        : await repState.addFollower(agentNode, address);
      await tx.wait();
      setStatus(isSepFollower ? "Unfollowed on Sepolia" : "Following on Sepolia!");
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message.slice(0, 80) : "Transaction failed");
    } finally {
      setSepoliaPending(false);
    }
  };

  const handleSettleSlash = async () => {
    if (!repStateAddr || !agentNode) { setStatus("Reputation contract not configured"); return; }
    const signer = await getSigner();
    if (!signer) { await connect(); return; }
    if (chainId !== SEPOLIA_CHAIN_ID) { await switchToSepolia(); return; }

    setSettlingSlash(true);
    setStatus("");
    try {
      const repState = new ethers.Contract(repStateAddr, REP_STATE_ABI, signer);
      const tx = await repState.settleSlash(agentNode);
      await tx.wait();
      setStatus("Slash settled — agent status restored");
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message.slice(0, 80) : "Failed to settle slash");
    } finally {
      setSettlingSlash(false);
    }
  };

  if (isSelf) return null;

  return (
    <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">Actions</h2>

      <div className="flex flex-wrap gap-2">
        {upAddress && (
          <button
            onClick={connected ? toggleFollow : connect}
            disabled={pending}
            className="text-sm px-4 py-2 rounded-lg border transition-colors disabled:opacity-50"
            style={{
              borderColor: following ? "rgba(123,97,255,0.4)" : "rgba(123,97,255,0.2)",
              color: following ? "#7B61FF" : "#9ca3af",
              background: following ? "rgba(123,97,255,0.08)" : "transparent",
            }}
          >
            {pending
              ? following ? "Unfollowing…" : "Following…"
              : !connected
              ? "Connect to follow"
              : following
              ? "Following on Lukso ✓"
              : "Follow on Lukso"}
          </button>
        )}

        {repStateAddr && (
          <button
            onClick={connected ? toggleSepoliaFollow : connect}
            disabled={sepoliaPending}
            className="text-sm px-4 py-2 rounded-lg border transition-colors disabled:opacity-50"
            style={{
              borderColor: isSepFollower ? "rgba(167,139,250,0.4)" : "rgba(167,139,250,0.15)",
              color: isSepFollower ? "#A78BFA" : "#9ca3af",
              background: isSepFollower ? "rgba(167,139,250,0.06)" : "transparent",
            }}
            title="Sepolia-native follow — participates in governance quorum"
          >
            {sepoliaPending
              ? isSepFollower ? "Unfollowing…" : "Following…"
              : !connected
              ? "Connect to follow on Sepolia"
              : isSepFollower
              ? "Following on Sepolia ✓"
              : "Follow on Sepolia"}
          </button>
        )}

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

        <button
          disabled
          className="text-sm px-4 py-2 rounded-lg border border-composia-border text-gray-600 opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          Request Service
        </button>
      </div>

      {isSlashed && slashExpired && repStateAddr && (
        <div className="pt-1 border-t border-composia-border/40">
          <button
            onClick={connected ? handleSettleSlash : connect}
            disabled={settlingSlash}
            className="text-sm px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/08 transition-colors disabled:opacity-50"
          >
            {settlingSlash ? "Settling…" : "Settle Slash (permissionless)"}
          </button>
          <p className="text-[10px] text-[#4a6670] mt-1.5">
            This slash has expired. Anyone can call settleSlash to restore the agent&apos;s status.
          </p>
        </div>
      )}

      {repStateAddr && !isSepFollower && connected && !isSelf && (
        <p className="text-[10px] text-[#4a6670]">
          Following on Sepolia adds you to governance quorum for this agent.
        </p>
      )}

      {status && (
        <p className="text-xs text-gray-500">{status}</p>
      )}
    </div>
  );
}
