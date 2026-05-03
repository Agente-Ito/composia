"use client";
import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import ProfileEditor from "./ProfileEditor";
import ControllersManager from "./ControllersManager";
import FollowAgents from "./FollowAgents";
import SocialRecovery from "./SocialRecovery";
import EnsNameManager from "./EnsNameManager";

interface Props {
  agentAddress: string;
  upAddress: string | null;
  kmAddress: string | null;
  /** Dev-only: bypass ownership check to preview the panel without a real wallet */
  devOwner?: boolean;
}

type TabId = "profile" | "controllers" | "follow" | "recovery" | "ens";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile",     label: "Edit Profile" },
  { id: "controllers", label: "Controllers" },
  { id: "follow",      label: "Follow Agents" },
  { id: "recovery",    label: "Social Recovery" },
  { id: "ens",         label: "ENS Name" },
];

export default function OwnerPanel({ agentAddress, upAddress, kmAddress, devOwner = false }: Props) {
  const { address, connected, connect } = useWallet();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  const isOwner =
    devOwner ||
    (connected &&
      !!address &&
      address.toLowerCase() === agentAddress.toLowerCase());

  // Not owner — render nothing (panel is owner-only)
  if (!devOwner && connected && !isOwner) return null;

  // Not connected — show a subtle banner to invite the owner to connect
  if (!devOwner && !connected) {
    return (
      <div
        className="rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ borderColor: "#0d1a24", background: "#050508" }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "#c8e6ea" }}>
            Are you the owner of this agent?
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#4a6670" }}>
            Connect your wallet to manage profile metadata, controllers, and more.
          </p>
        </div>
        <button
          onClick={connect}
          className="shrink-0 text-xs font-mono px-4 py-2 rounded-lg border transition-colors hover:bg-composia-cyan/10"
          style={{ borderColor: "rgba(123,97,255,0.3)", color: "#7B61FF" }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // Owner — show the full management panel
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "rgba(123,97,255,0.3)" }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid #0d1a24", background: "rgba(123,97,255,0.05)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-live-pulse"
            style={{ background: "#A78BFA" }}
          />
          <span className="text-xs font-semibold" style={{ color: "#7B61FF" }}>
            {devOwner ? "Owner Panel — dev preview" : "You own this profile"}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "#4a6670" }}>
          {agentAddress.slice(0, 6)}…{agentAddress.slice(-4)}
        </span>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b"
        style={{ borderColor: "#0d1a24", background: "#050508" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-mono transition-colors relative"
            style={{
              color: activeTab === tab.id ? "#7B61FF" : "#4a6670",
              background: "transparent",
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: "#7B61FF" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5" style={{ background: "#050508" }}>
        {activeTab === "profile" && (
          <ProfileEditor
            agentAddress={agentAddress}
            upAddress={upAddress}
            kmAddress={kmAddress}
          />
        )}
        {activeTab === "controllers" && (
          <ControllersManager upAddress={upAddress} kmAddress={kmAddress} />
        )}
        {activeTab === "follow" && (
          <FollowAgents upAddress={upAddress} />
        )}
        {activeTab === "recovery" && (
          <SocialRecovery upAddress={upAddress} />
        )}
        {activeTab === "ens" && (
          <EnsNameManager agentAddress={agentAddress} />
        )}
      </div>
    </div>
  );
}
