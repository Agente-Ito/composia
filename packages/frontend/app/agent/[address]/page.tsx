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

// Skip SSR — OwnerPanel requires browser wallet APIs
const OwnerPanel = dynamic(() => import("@/components/owner/OwnerPanel"), {
  ssr: false,
  loading: () => null,
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function buildProfile(address: string): Promise<AgentProfile | null> {
  const registryConfigured = !!(
    process.env.ATTESTOR_REGISTRY_ADDRESS &&
    process.env.ATTESTOR_REGISTRY_ADDRESS !== "0x..."
  );

  const onChain = registryConfigured ? await getAgentFromRegistry(address) : null;
  const now = Math.floor(Date.now() / 1000);

  // Preview / demo mode — no contract needed
  if (!onChain || onChain.upAddress === ZERO_ADDRESS) {
    const core = previewCoreData(address);
    const extended = generateMockExtendedData(address, core);
    const synced   = previewSynced(address);
    const syncedChains: ChainStatus[] = [
      {
        name: "Lukso Testnet",
        chainId: 4201,
        accuracy: core.accuracy,
        verifications: core.verifications,
        receivedAt: now - 3600,
        synced: true,
      },
    ];
    if (synced) {
      syncedChains.push({
        name: "Ethereum Sepolia",
        chainId: 11155111,
        accuracy: core.accuracy,
        verifications: core.verifications,
        receivedAt: now - 7200,
        synced: true,
      });
    }
    return {
      agentAddress: address,
      upAddress:  previewUpAddress(address),
      kmAddress:  previewKmAddress(address),
      reputation: {
        accuracy: core.accuracy,
        verifications: core.verifications,
        correct: Math.round((core.accuracy / 100) * core.verifications),
        lastUpdated: now - 3600,
        joinedAt: core.joinedAt,
        synced,
        ...extended,
      },
      syncedChains,
    };
  }

  // Real on-chain data + extended mock
  const syncedChains: ChainStatus[] = [
    {
      name: "Lukso Testnet",
      chainId: 4201,
      accuracy: onChain.accuracy,
      verifications: onChain.verifications,
      receivedAt: onChain.lastUpdated,
      synced: true,
    },
  ];

  const sepoliaAddress = process.env.SYNCER_ETHEREUM_ADDRESS;
  const sepoliaRpc = process.env.ETHEREUM_SEPOLIA_RPC;
  if (sepoliaAddress && sepoliaRpc) {
    const sep = await getSyncerReputation(address, sepoliaAddress, sepoliaRpc);
    syncedChains.push({
      name: "Ethereum Sepolia",
      chainId: 11155111,
      accuracy: sep?.accuracy ?? null,
      verifications: sep?.verifications ?? null,
      receivedAt: sep?.receivedAt ?? null,
      synced: (sep?.receivedAt ?? 0) > 0,
    });
  }

  const extended = generateMockExtendedData(address, {
    accuracy: onChain.accuracy,
    verifications: onChain.verifications,
    joinedAt: onChain.joinedAt,
  });

  return {
    agentAddress: address,
    upAddress: onChain.upAddress,
    kmAddress: onChain.kmAddress ?? null,
    reputation: {
      accuracy: onChain.accuracy,
      verifications: onChain.verifications,
      correct: Math.round((onChain.accuracy / 100) * onChain.verifications),
      lastUpdated: onChain.lastUpdated,
      joinedAt: onChain.joinedAt,
      synced: onChain.synced,
      ...extended,
    },
    syncedChains,
  };
}

const DOMAIN_LABELS: Record<string, string> = {
  codeReasoning: "Code",
  mathReasoning: "Math",
  logicReasoning: "Logic",
};

export default async function AgentProfilePage({
  params,
  searchParams,
}: {
  params: { address: string };
  searchParams?: { devOwner?: string };
}) {
  const { address } = params;
  const devOwner = searchParams?.devOwner === "1";
  const profile = await buildProfile(address);

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-2xl font-bold">Agent not found</h1>
        <p className="text-gray-400">
          This agent hasn&apos;t been registered in Composia yet.
        </p>
        <Link
          href="/demo"
          className="inline-block mt-4 bg-composia-cyan text-black px-5 py-2 rounded-lg"
        >
          Simulate their reputation →
        </Link>
      </div>
    );
  }

  const rep = profile.reputation!;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      <Link
        href="/grid"
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Back
      </Link>

      {/* ── HERO ── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex justify-center md:justify-start w-full md:w-auto">
            <ReputationGauge
              accuracy={rep.accuracy}
              trend={rep.trend}
              consistency={rep.consistency}
            />
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-sora text-xl font-bold glow-cyan">{rep.history.nodeName}</h1>
                <p className="font-mono text-sm text-gray-400 break-all">{address}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Node ID:{" "}
                  <span className="text-gray-400">{rep.history.nodeId}</span>
                </p>
              </div>
              <span className="shrink-0 bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">
                ✓ Verified on Gensyn
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Problems Solved", value: rep.verifications.toLocaleString() },
                { label: "Correct", value: rep.correct.toLocaleString() },
                { label: "Earnings", value: `${rep.history.totalEarnings.toFixed(1)} GNY` },
                {
                  label: "Best Domain",
                  value: DOMAIN_LABELS[rep.specialization.bestDomain],
                },
              ].map((s) => (
                <div key={s.label} className="bg-composia-dark/60 rounded-lg p-3">
                  <div className="text-[10px] text-gray-400">{s.label}</div>
                  <div className="font-bold text-sm mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>

            <BadgeList
              accuracy={rep.accuracy}
              verifications={rep.verifications}
              joinedAt={rep.joinedAt}
            />
          </div>
        </div>
      </div>

      {/* ── SPECIALIZATION | RELIABILITY | SOCIAL PROOF ── */}
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
          <ReliabilityScorecard
            reliability={rep.reliability}
            history={rep.history}
          />
        </div>

        <div className="bg-composia-card border border-composia-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Social Proof</h2>
          <div className="space-y-2.5">
            {[
              {
                label: "Avg Rating",
                value: (
                  <span className="text-yellow-400 font-bold">
                    ⭐ {rep.socialGraph.averageRating.toFixed(1)}/5
                  </span>
                ),
              },
              { label: "Peer Reviews", value: rep.socialGraph.ratingCount },
              {
                label: "Collaborators",
                value: `${rep.socialGraph.collaboratorsCount} agents`,
              },
              { label: "Endorsements", value: rep.socialGraph.endorsementCount },
              {
                label: "Network Hub",
                value: `${(rep.socialGraph.networkCentrality * 100).toFixed(0)}%`,
              },
              {
                label: "Active Streak",
                value: `${rep.history.consecutiveDaysActive} days`,
              },
              {
                label: "Velocity",
                value: `${rep.history.activityVelocity.toFixed(1)} prob/day`,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-400">{row.label}</span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ACTIVITY TIMELINE ── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Activity Timeline</h2>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-composia-cyan inline-block" />
              Problems solved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-blue-400 border-dashed inline-block" />
              Accuracy %
            </span>
          </div>
        </div>
        <ActivityTimeline data={rep.activityTimeline} />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>
            Joined{" "}
            {new Date(rep.joinedAt * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span>
            Last active{" "}
            {new Date(rep.lastUpdated * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* ── SOCIAL NETWORK ── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Collaboration Network</h2>
        <SocialNetworkGraph
          agentAddress={address}
          partners={rep.socialGraph.frequentPartners}
          collaboratorsCount={rep.socialGraph.collaboratorsCount}
        />
      </div>

      {/* ── PROFILE COMPLETENESS ── */}
      <div className="bg-composia-card border border-composia-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Profile Completeness</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "UP Created",
              done: !!profile.upAddress,
              detail: "Universal Profile deployed on Lukso",
            },
            {
              label: "Reputation Linked",
              done: rep.verifications > 0,
              detail: "Gensyn data written to UP storage",
            },
            {
              label: "Ownership Claimed",
              done: !!profile.upAddress && previewClaimed(address),
              detail: "Accept KeyManager ownership to control your UP",
              action: profile.upAddress && !previewClaimed(address)
                ? { label: "Claim now →", href: `/claim/${profile.upAddress}` }
                : null,
            },
            {
              label: "Social Recovery",
              done: false,
              detail: "Add guardians to recover access if key is lost",
              soon: true,
            },
          ].map((step) => (
            <div
              key={step.label}
              className={`rounded-lg p-3 space-y-1.5 border ${
                step.done
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-composia-border bg-composia-dark/40"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-sm ${step.done ? "text-green-400" : "text-gray-600"}`}>
                  {step.done ? "✓" : "○"}
                </span>
                <span className={`text-xs font-medium ${step.done ? "text-green-300" : "text-gray-300"}`}>
                  {step.label}
                  {"soon" in step && step.soon && (
                    <span className="ml-1 text-[9px] text-gray-600 uppercase tracking-wide">soon</span>
                  )}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">{step.detail}</p>
              {"action" in step && step.action && (
                <Link
                  href={step.action.href}
                  className="text-[10px] text-composia-cyan hover:underline"
                >
                  {step.action.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── ENS IDENTITY ── */}
      {(() => {
        const ensLabel   = address.slice(2, 10).toLowerCase();
        const ensName    = `${ensLabel}.composia.eth`;
        const ensAppUrl  = `https://app.ens.domains/${ensName}`;
        const configured = !!process.env.ENS_REGISTRAR_ADDRESS;
        return (
          <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">ENS Identity</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                configured
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-gray-700/40 text-gray-500 border-gray-700"
              }`}>
                {configured ? "✓ Registered on Sepolia" : "Pending registration"}
              </span>
            </div>

            <div className="font-mono text-composia-cyan text-sm">{ensName}</div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["gensyn:accuracy",      `${rep.accuracy}%`],
                ["gensyn:verifications", rep.verifications.toLocaleString()],
                ["gensyn:up_address",    profile.upAddress ? profile.upAddress.slice(0, 18) + "…" : "—"],
                ["url",                  `composia.app/agent/${address.slice(0, 10)}…`],
              ].map(([key, val]) => (
                <div key={key} className="bg-composia-dark/60 rounded px-2 py-1.5 space-y-0.5">
                  <div className="font-mono text-[9px] text-gray-500">{key}</div>
                  <div className="text-gray-300">{val}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <a
                href={ensAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors"
              >
                View on ENS App ↗
              </a>
              <a
                href={`https://sepolia.etherscan.io/enslookup-search?search=${ensName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors"
              >
                Sepolia Etherscan ↗
              </a>
            </div>
          </div>
        );
      })()}

      {/* ── UNIVERSAL PROFILE + CROSS-CHAIN ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-composia-card border border-composia-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Universal Profile</h2>
          {profile.upAddress ? (
            <div className="space-y-3">
              <div className="font-mono text-sm text-composia-cyan break-all">
                {profile.upAddress}
              </div>
              {profile.kmAddress && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-0.5">KeyManager</div>
                  <div className="font-mono text-xs text-gray-400 break-all">{profile.kmAddress}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://universalprofile.cloud/address/${profile.upAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition-colors"
                >
                  View on UP Cloud ↗
                </a>
                <Link
                  href={`/claim/${profile.upAddress}`}
                  className="text-xs bg-composia-cyan text-black px-3 py-1.5 rounded-lg hover:bg-composia-cyan/90 transition-colors"
                >
                  Claim Ownership
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              Profile not yet on-chain — deploy contracts and simulate an event to create one.
            </p>
          )}

          <div className="mt-3 space-y-1">
            <div className="text-xs text-gray-500 mb-2">LSP3 data (on-chain when live)</div>
            {[
              ["gensyn:reputation", `${rep.accuracy}%`],
              ["gensyn:verifications", rep.verifications.toLocaleString()],
              ["gensyn:correct", rep.correct.toLocaleString()],
              [
                "gensyn:joined",
                new Date(rep.joinedAt * 1000).toISOString().slice(0, 10),
              ],
              [
                "gensyn:last_activity",
                new Date(rep.lastUpdated * 1000).toISOString().slice(0, 10),
              ],
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

      {/* ── OWNER PANEL ── */}
      <OwnerPanel
        agentAddress={address}
        upAddress={profile.upAddress}
        kmAddress={profile.kmAddress}
        devOwner={devOwner}
      />

      <div className="text-center pb-4">
        <a
          href={`/api/agent/${address}`}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          View raw JSON →
        </a>
      </div>
    </div>
  );
}
