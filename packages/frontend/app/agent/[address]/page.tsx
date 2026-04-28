import { getAgentFromRegistry, getSyncerReputation } from "@/lib/contracts";
import { generateMockExtendedData, previewCoreData, previewUpAddress, previewKmAddress, previewClaimed, previewSynced } from "@/lib/mock-data";
import { AgentProfile, ChainStatus } from "@/lib/types";
import ReputationGauge from "@/components/ReputationGauge";
import SpecializationRadar from "@/components/SpecializationRadar";
import ReliabilityScorecard from "@/components/ReliabilityScorecard";
import SocialNetworkGraph from "@/components/SocialNetworkGraph";
import ActivityTimeline from "@/components/ActivityTimeline";
import BadgeList from "@/components/BadgeList";
import ChainSyncStatus from "@/components/ChainSyncStatus";
import dynamic from "next/dynamic";
import Link from "next/link";

const OwnerPanel = dynamic(() => import("@/components/owner/OwnerPanel"), {
  ssr: false,
  loading: () => null,
});

const VisitorActions = dynamic(() => import("@/components/VisitorActions"), {
  ssr: false,
  loading: () => null,
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ── Data fetchers ────────────────────────────────────────────────────────────

async function buildProfile(address: string): Promise<AgentProfile | null> {
  const registryConfigured = !!(
    process.env.ATTESTOR_REGISTRY_ADDRESS &&
    process.env.ATTESTOR_REGISTRY_ADDRESS !== "0x..."
  );

  const onChain = registryConfigured ? await getAgentFromRegistry(address) : null;
  const now = Math.floor(Date.now() / 1000);

  if (!onChain || onChain.upAddress === ZERO_ADDRESS) {
    const core     = previewCoreData(address);
    const extended = generateMockExtendedData(address, core);
    const synced   = previewSynced(address);
    const syncedChains: ChainStatus[] = [
      { name: "Lukso Testnet", chainId: 4201, accuracy: core.accuracy, verifications: core.verifications, receivedAt: now - 3600, synced: true },
    ];
    if (synced) {
      syncedChains.push({ name: "Ethereum Sepolia", chainId: 11155111, accuracy: core.accuracy, verifications: core.verifications, receivedAt: now - 7200, synced: true });
    }
    return {
      agentAddress: address,
      upAddress:    previewUpAddress(address),
      kmAddress:    previewKmAddress(address),
      reputation: {
        accuracy: core.accuracy, verifications: core.verifications,
        correct: Math.round((core.accuracy / 100) * core.verifications),
        lastUpdated: now - 3600, joinedAt: core.joinedAt, synced, ...extended,
      },
      syncedChains,
    };
  }

  const syncedChains: ChainStatus[] = [
    { name: "Lukso Testnet", chainId: 4201, accuracy: onChain.accuracy, verifications: onChain.verifications, receivedAt: onChain.lastUpdated, synced: true },
  ];
  const sepoliaAddress = process.env.SYNCER_ETHEREUM_ADDRESS;
  const sepoliaRpc     = process.env.ETHEREUM_SEPOLIA_RPC;
  if (sepoliaAddress && sepoliaRpc) {
    const sep = await getSyncerReputation(address, sepoliaAddress, sepoliaRpc);
    syncedChains.push({
      name: "Ethereum Sepolia", chainId: 11155111,
      accuracy: sep?.accuracy ?? null, verifications: sep?.verifications ?? null,
      receivedAt: sep?.receivedAt ?? null, synced: (sep?.receivedAt ?? 0) > 0,
    });
  }

  const extended = generateMockExtendedData(address, { accuracy: onChain.accuracy, verifications: onChain.verifications, joinedAt: onChain.joinedAt });
  return {
    agentAddress: address,
    upAddress:  onChain.upAddress,
    kmAddress:  onChain.kmAddress ?? null,
    reputation: {
      accuracy: onChain.accuracy, verifications: onChain.verifications,
      correct: Math.round((onChain.accuracy / 100) * onChain.verifications),
      lastUpdated: onChain.lastUpdated, joinedAt: onChain.joinedAt, synced: onChain.synced,
      ...extended,
    },
    syncedChains,
  };
}

// ── Reactive state (Ethereum Sepolia) ────────────────────────────────────────

interface ReactiveState {
  reputation: number; reputationPct: number; verified: boolean;
  slashed: boolean; slashExpiresAt: number; followerCount: number;
  quorum: number; threshold: number; thresholdPct: number;
  slashTimeRemaining: number; meetsThreshold: boolean;
  agentLabels: string[];
  primaryLabel: string;
  sepoliaFollowers: string[];
}

async function fetchReactiveState(address: string): Promise<ReactiveState | null> {
  const rpc             = process.env.ETHEREUM_SEPOLIA_RPC;
  const repStateAddr    = process.env.REPUTATION_STATE_ADDRESS;
  const nameManagerAddr = process.env.ENS_NAME_MANAGER_ADDRESS;
  if (!rpc || !repStateAddr) return null;

  try {
    const { ethers } = await import("ethers");
    const provider   = new ethers.JsonRpcProvider(rpc);
    const repState   = new ethers.Contract(repStateAddr, [
      "function getCurrentStatus(bytes32 node) external view returns (uint256,bool,bool,uint256,uint256,uint256)",
      "function getQuorum(bytes32 node) external view returns (uint256)",
      "function verificationThreshold() external view returns (uint256)",
      "function getAgentLabels(address agent) external view returns (string[] memory)",
      "function getSepoliaFollowers(bytes32 node) external view returns (address[] memory)",
    ], provider);

    const nameManager = nameManagerAddr
      ? new ethers.Contract(nameManagerAddr, [
          "function getPrimaryLabel(address agent) external view returns (string)",
        ], provider)
      : null;

    const autoLabel = address.slice(2, 10).toLowerCase();
    const ensName   = `${autoLabel}.composia.eth`;
    const node      = ethers.namehash(ensName);

    const [status, quorum, threshold, rawLabels, rawFollowers, rawPrimary] = await Promise.all([
      repState.getCurrentStatus(node),
      repState.getQuorum(node),
      repState.verificationThreshold(),
      repState.getAgentLabels(address).catch(() => []),
      repState.getSepoliaFollowers(node).catch(() => []),
      nameManager ? nameManager.getPrimaryLabel(address).catch(() => null) : Promise.resolve(null),
    ]);

    const rep       = Number(status[0]);
    const thresh    = Number(threshold);
    const expiresAt = Number(status[3]);
    const labels    = Array.isArray(rawLabels) && rawLabels.length > 0
      ? rawLabels.map(String)
      : [autoLabel];
    const primaryLabel = (typeof rawPrimary === "string" && rawPrimary) ? rawPrimary : labels[0];

    return {
      reputation: rep, reputationPct: rep / 100,
      verified: Boolean(status[1]), slashed: Boolean(status[2]),
      slashExpiresAt: expiresAt, followerCount: Number(status[4]),
      quorum: Number(quorum), threshold: thresh, thresholdPct: thresh / 100,
      slashTimeRemaining: status[2] && expiresAt > 0
        ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : 0,
      meetsThreshold: rep >= thresh,
      agentLabels: labels,
      primaryLabel,
      sepoliaFollowers: Array.isArray(rawFollowers) ? rawFollowers.map(String) : [],
    };
  } catch { return null; }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  codeReasoning: "Code",
  mathReasoning: "Math",
  logicReasoning: "Logic",
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function AgentProfilePage({
  params,
  searchParams,
}: {
  params: { address: string };
  searchParams?: { devOwner?: string };
}) {
  const { address } = params;
  const devOwner    = searchParams?.devOwner === "1";

  const [profile, reactive] = await Promise.all([
    buildProfile(address),
    fetchReactiveState(address),
  ]);

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <p className="text-gray-400">This agent hasn&apos;t been registered in Composia yet.</p>
        <Link href="/demo" className="inline-block mt-4 bg-composia-cyan text-black px-5 py-2 rounded-lg">
          Simulate their reputation →
        </Link>
      </div>
    );
  }

  const rep = profile.reputation!;

  // Derived ENS values
  const autoLabel    = address.slice(2, 10).toLowerCase();
  const primaryLabel = reactive?.primaryLabel ?? autoLabel;
  const displayName  = `${primaryLabel}.composia.eth`;
  const allLabels    = reactive?.agentLabels ?? [autoLabel];
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  const isClaimed    = previewClaimed(address);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      <Link href="/grid" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
        ← Back
      </Link>

      {/* ── 1. AGENT NAME HEADER ─────────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-sora text-2xl font-bold glow-cyan truncate">{displayName}</h1>
            <p className="font-mono text-sm text-gray-400 break-all mt-0.5">{address}</p>
            {reactive && allLabels.length > 1 && (
              <p className="text-[11px] text-gray-600 mt-1">
                Also known as: {allLabels.filter(l => l !== primaryLabel).map(l => `${l}.composia.eth`).join(", ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Live status badge */}
            {reactive ? (
              reactive.slashed ? (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">⚡ Slashed</span>
              ) : reactive.verified ? (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-green-500/10 text-green-400 border-green-500/20">✓ Verified</span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">⚠ Below threshold</span>
              )
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full border bg-gray-700/40 text-gray-500 border-gray-700">Pending</span>
            )}
            {/* Claim button — visible only when UP exists and not yet claimed */}
            {profile.upAddress && !isClaimed && (
              <Link
                href={`/claim/${profile.upAddress}`}
                className="text-xs px-3 py-1.5 rounded-lg border border-composia-cyan/30 text-composia-cyan hover:bg-composia-cyan/10 transition-colors"
              >
                Claim Profile →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. REPUTATION HERO ───────────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex justify-center md:justify-start w-full md:w-auto">
            <ReputationGauge accuracy={rep.accuracy} trend={rep.trend} consistency={rep.consistency} />
          </div>
          <div className="flex-1 space-y-4 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-gray-400">{rep.history.nodeId}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Last updated{" "}
                  {new Date(rep.lastUpdated * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <span className="shrink-0 bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">
                ✓ Verified on Gensyn
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Problems Solved", value: rep.verifications.toLocaleString() },
                { label: "Correct",         value: rep.correct.toLocaleString() },
                { label: "Earnings",        value: `${rep.history.totalEarnings.toFixed(1)} GNY` },
                { label: "Best Domain",     value: DOMAIN_LABELS[rep.specialization.bestDomain] },
              ].map(s => (
                <div key={s.label} className="bg-composia-dark/60 rounded-lg p-3">
                  <div className="text-[10px] text-gray-400">{s.label}</div>
                  <div className="font-bold text-sm mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. CAPABILITIES & BADGES ─────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Capabilities & Recognition</h2>
        <BadgeList accuracy={rep.accuracy} verifications={rep.verifications} joinedAt={rep.joinedAt} />
        {reactive && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {reactive.verified && (
              <>
                <CapabilityRow icon="✓" text="Can participate in governance" color="green" />
                <CapabilityRow icon="✓" text="Eligible for marketplace services" color="green" />
              </>
            )}
            {reactive.meetsThreshold && !reactive.verified && (
              <CapabilityRow icon="⏳" text="Meets reputation threshold — awaiting verification sync" color="yellow" />
            )}
            {reactive.slashed && (
              <CapabilityRow
                icon="⚡"
                text={reactive.slashTimeRemaining > 0
                  ? `Temporarily slashed — ${reactive.slashTimeRemaining > 86400 ? `${Math.floor(reactive.slashTimeRemaining / 86400)}d` : `${Math.floor(reactive.slashTimeRemaining / 3600)}h`} remaining`
                  : "Slash expired — call settleSlash to restore"}
                color="red"
              />
            )}
            {reactive.followerCount > 0 && (
              <CapabilityRow
                icon="👥"
                text={`Governance quorum: ${reactive.quorum} of ${reactive.followerCount} followers`}
                color="blue"
              />
            )}
            {!reactive.verified && !reactive.meetsThreshold && (
              <CapabilityRow icon="○" text={`Reputation ${reactive.reputationPct.toFixed(1)}% — needs ${reactive.thresholdPct.toFixed(0)}% to unlock verification`} color="gray" />
            )}
          </div>
        )}
      </div>

      {/* ── 4. PROFILE GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-composia-card border border-composia-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Specialization</h2>
          <SpecializationRadar domains={rep.specialization.domains} />
          <p className="text-[11px] text-gray-500 text-center mt-3">
            Languages: {rep.specialization.languages.join(", ")}
          </p>
        </div>
        <div className="bg-composia-card border border-composia-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Reliability</h2>
          <ReliabilityScorecard reliability={rep.reliability} history={rep.history} />
        </div>
        <div className="bg-composia-card border border-composia-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Social Proof</h2>
          <div className="space-y-2.5">
            {[
              { label: "Avg Rating",      value: <span className="text-yellow-400 font-bold">⭐ {rep.socialGraph.averageRating.toFixed(1)}/5</span> },
              { label: "Peer Reviews",    value: rep.socialGraph.ratingCount },
              { label: "Collaborators",   value: `${rep.socialGraph.collaboratorsCount} agents` },
              { label: "Endorsements",    value: rep.socialGraph.endorsementCount },
              { label: "Network Hub",     value: `${(rep.socialGraph.networkCentrality * 100).toFixed(0)}%` },
              { label: "Active Streak",   value: `${rep.history.consecutiveDaysActive} days` },
              { label: "Velocity",        value: `${rep.history.activityVelocity.toFixed(1)} prob/day` },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. ACTIVITY TIMELINE ────────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Activity Timeline</h2>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-composia-cyan inline-block" /> Problems solved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-blue-400 border-dashed inline-block" /> Accuracy %
            </span>
          </div>
        </div>
        <ActivityTimeline data={rep.activityTimeline} />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Joined {new Date(rep.joinedAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          <span>Last active {new Date(rep.lastUpdated * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>

      {/* ── 6. COLLABORATION NETWORK ─────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Collaboration Network</h2>
        <SocialNetworkGraph agentAddress={address} partners={rep.socialGraph.frequentPartners} collaboratorsCount={rep.socialGraph.collaboratorsCount} />
      </div>

      {/* ── 7. ALL ENS NAMES ────────────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Identity Names</h2>
          <span className="text-[10px] text-gray-600">All resolve to the same profile</span>
        </div>
        <div className="divide-y divide-composia-border/40">
          {allLabels.map(label => {
            const name      = `${label}.composia.eth`;
            const isPrimary = label === primaryLabel;
            return (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-mono text-sm truncate ${isPrimary ? "text-composia-cyan" : "text-gray-400"}`}>
                    {name}
                  </span>
                  {isPrimary && (
                    <span className="shrink-0 text-[9px] bg-composia-cyan/10 text-composia-cyan border border-composia-cyan/20 px-1.5 py-0.5 rounded-full">
                      primary
                    </span>
                  )}
                </div>
                <a
                  href={`https://app.ens.domains/${name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  ENS ↗
                </a>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-600">
          Auto-generated on UP creation. Custom names can be set from the Owner Panel.
        </p>
      </div>

      {/* ── 8. FOLLOWERS & QUORUM ───────────────────────────────────────── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Followers</h2>
          {reactive && reactive.followerCount > 0 && (
            <span className="text-xs text-gray-500">
              Governance quorum: <span className="text-white font-medium">{reactive.quorum}</span> of {reactive.followerCount}
            </span>
          )}
        </div>

        {reactive && reactive.followerCount > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-composia-dark/60 rounded-lg p-3 text-center">
                <div className="text-[10px] text-gray-500 mb-0.5">Total Followers</div>
                <div className="font-bold text-xl">{reactive.followerCount}</div>
              </div>
              <div className="bg-composia-dark/60 rounded-lg p-3 text-center">
                <div className="text-[10px] text-gray-500 mb-0.5">Quorum Needed</div>
                <div className="font-bold text-xl text-composia-cyan">{reactive.quorum}</div>
              </div>
            </div>

            {reactive.sepoliaFollowers.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">On-chain (Sepolia)</div>
                {reactive.sepoliaFollowers.slice(0, 5).map(addr => (
                  <div key={addr} className="flex items-center justify-between py-1.5 border-b border-composia-border/30 last:border-0">
                    <span className="font-mono text-xs text-gray-400">
                      {addr.slice(0, 10)}…{addr.slice(-6)}
                    </span>
                    <Link href={`/agent/${addr}`} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
                      View →
                    </Link>
                  </div>
                ))}
                {reactive.sepoliaFollowers.length > 5 && (
                  <p className="text-xs text-gray-600 text-center pt-1">
                    +{reactive.sepoliaFollowers.length - 5} more followers
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic">
                Follower list tracked on Lukso via LSP26 — synced periodically to Sepolia.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No followers yet.</p>
        )}
      </div>

      {/* ── 9. VISITOR ACTIONS ──────────────────────────────────────────── */}
      <VisitorActions agentAddress={address} upAddress={profile.upAddress} />

      {/* ── 10. ENS REACTIVE STATE (simplified) ─────────────────────────── */}
      {(() => {
        const layer2Active = !!reactive;
        const layer1Active = !!process.env.ENS_REGISTRAR_ADDRESS;
        return (
          <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Reputation State</h2>
                <div className="font-mono text-composia-cyan text-xs mt-0.5">{displayName}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {layer2Active ? (
                  reactive!.slashed ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">⚡ Slashed</span>
                  ) : reactive!.verified ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20">✓ Verified (live)</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">⚠ Below threshold</span>
                  )
                ) : layer1Active ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-700/30">Layer 1 only</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-700/40 text-gray-500 border-gray-700">Pending</span>
                )}
              </div>
            </div>

            {layer2Active && reactive && (
              <div className="space-y-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Layer 2 — Reactive State (Sepolia)</div>

                {/* Reputation bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Reputation</span>
                    <span className={reactive.meetsThreshold ? "text-green-400" : "text-yellow-400"}>
                      {reactive.reputationPct.toFixed(1)}%
                      <span className="text-gray-600 ml-1">(threshold {reactive.thresholdPct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${reactive.meetsThreshold ? "bg-green-400" : "bg-yellow-400"}`}
                      style={{ width: `${Math.min(reactive.reputationPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-composia-dark/60 rounded px-2 py-2 text-center">
                    <div className="text-gray-500 text-[9px]">Followers</div>
                    <div className="font-bold mt-0.5">{reactive.followerCount}</div>
                  </div>
                  <div className="bg-composia-dark/60 rounded px-2 py-2 text-center">
                    <div className="text-gray-500 text-[9px]">Quorum</div>
                    <div className="font-bold mt-0.5">{reactive.quorum}</div>
                  </div>
                  <div className={`rounded px-2 py-2 text-center ${
                    reactive.slashed ? "bg-red-500/10 border border-red-500/20"
                    : reactive.verified ? "bg-green-500/10 border border-green-500/20"
                    : "bg-composia-dark/60"
                  }`}>
                    <div className="text-gray-500 text-[9px]">Status</div>
                    <div className={`font-bold mt-0.5 text-[10px] ${
                      reactive.slashed ? "text-red-400" : reactive.verified ? "text-green-400" : "text-yellow-400"
                    }`}>
                      {reactive.slashed ? "SLASHED" : reactive.verified ? "ACTIVE" : "PENDING"}
                    </div>
                  </div>
                </div>

                {/* Slash expiry */}
                {reactive.slashed && reactive.slashTimeRemaining > 0 && (
                  <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded px-3 py-2">
                    Slash expires in{" "}
                    <span className="font-mono font-bold">
                      {reactive.slashTimeRemaining > 86400
                        ? `${Math.floor(reactive.slashTimeRemaining / 86400)}d`
                        : `${Math.floor(reactive.slashTimeRemaining / 3600)}h`}
                    </span>
                    {" "}· Verification restores automatically if rep ≥ {reactive.thresholdPct.toFixed(0)}%
                  </div>
                )}

                {/* DeFi composability */}
                <div className="text-[10px] text-gray-600 bg-composia-dark/40 rounded px-3 py-2 space-y-0.5">
                  <div className="text-gray-500 font-medium">DeFi composability hooks</div>
                  <div className="font-mono">
                    isCurrentlyVerified({primaryLabel.slice(0, 6)}…) →{" "}
                    <span className={reactive.verified && !reactive.slashed ? "text-green-400" : "text-red-400"}>
                      {String(reactive.verified && !reactive.slashed)}
                    </span>
                  </div>
                  <div className="font-mono">
                    getQuorum({primaryLabel.slice(0, 6)}…) →{" "}
                    <span className="text-composia-cyan">{reactive.quorum}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Layer 1 text records */}
            <div className="space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">Layer 1 — Historical (ENS text records)</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["gensyn:accuracy",       `${rep.accuracy}%`],
                  ["gensyn:verifications",  rep.verifications.toLocaleString()],
                  ["gensyn:verified_since", "set at registration"],
                  ["gensyn:up_address",     profile.upAddress ? profile.upAddress.slice(0, 14) + "…" : "—"],
                ].map(([key, val]) => (
                  <div key={key} className="bg-composia-dark/60 rounded px-2 py-1.5 space-y-0.5">
                    <div className="font-mono text-[9px] text-gray-500">{key}</div>
                    <div className="text-gray-300">{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={`https://app.ens.domains/${displayName}`} target="_blank" rel="noopener noreferrer"
                className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors">
                ENS App ↗
              </a>
              {repStateAddr && (
                <a href={`https://sepolia.etherscan.io/address/${repStateAddr}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors">
                  ReputationState ↗
                </a>
              )}
              <a href={`/api/reputation/${address}`} target="_blank" rel="noopener noreferrer"
                className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors">
                Raw JSON ↗
              </a>
            </div>
          </div>
        );
      })()}

      {/* ── 11. UNIVERSAL PROFILE + CROSS-CHAIN ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Universal Profile</h2>
          {profile.upAddress ? (
            <div className="space-y-3">
              <div className="font-mono text-sm text-composia-cyan break-all">{profile.upAddress}</div>
              {profile.kmAddress && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-0.5">KeyManager</div>
                  <div className="font-mono text-xs text-gray-400 break-all">{profile.kmAddress}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <a href={`https://universalprofile.cloud/address/${profile.upAddress}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors">
                  UP Cloud ↗
                </a>
                <Link href={`/claim/${profile.upAddress}`}
                  className="text-xs bg-composia-cyan text-black px-3 py-1.5 rounded-lg hover:bg-composia-cyan/90 transition-colors">
                  Claim Ownership
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Profile not yet on-chain.</p>
          )}
          <div className="mt-3 space-y-1">
            <div className="text-xs text-gray-500 mb-2">LSP3 data</div>
            {[
              ["gensyn:reputation",    `${rep.accuracy}%`],
              ["gensyn:verifications", rep.verifications.toLocaleString()],
              ["gensyn:correct",       rep.correct.toLocaleString()],
              ["gensyn:joined",        new Date(rep.joinedAt * 1000).toISOString().slice(0, 10)],
              ["gensyn:last_activity", new Date(rep.lastUpdated * 1000).toISOString().slice(0, 10)],
            ].map(([key, val]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="font-mono text-gray-500">{key}</span>
                <span className="text-gray-300">{val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Cross-Chain Sync</h2>
          <ChainSyncStatus chains={profile.syncedChains} />
        </div>
      </div>

      {/* ── 12. OWNER PANEL ─────────────────────────────────────────────── */}
      <OwnerPanel
        agentAddress={address}
        upAddress={profile.upAddress}
        kmAddress={profile.kmAddress}
        devOwner={devOwner}
      />

      <div className="text-center pb-4">
        <a href={`/api/agent/${address}`} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          View raw JSON →
        </a>
      </div>
    </div>
  );
}

// ── Helper component (inline, server-side) ───────────────────────────────────

function CapabilityRow({ icon, text, color }: { icon: string; text: string; color: "green" | "yellow" | "red" | "blue" | "gray" }) {
  const styles: Record<typeof color, string> = {
    green:  "bg-green-500/5  border-green-500/15  text-green-300",
    yellow: "bg-yellow-500/5 border-yellow-500/15 text-yellow-300",
    red:    "bg-red-500/5    border-red-500/15    text-red-300",
    blue:   "bg-blue-500/5   border-blue-500/15   text-blue-300",
    gray:   "bg-gray-800/40  border-gray-700/40   text-gray-400",
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${styles[color]}`}>
      <span className="shrink-0 mt-px">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
