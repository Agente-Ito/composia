import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentFromRegistry, getSyncerReputation } from "@/lib/contracts";
import { generateMockExtendedData } from "@/lib/mock-data";
import { AgentProfile, ChainStatus } from "@/lib/types";
import { keeperLog } from "@/lib/keeper-log";

// Namespace offchain API — staging for Sepolia, mainnet for production
const NAMESPACE_API =
  process.env.NAMESPACE_MODE === "mainnet"
    ? "https://offchain-manager.namespace.ninja"
    : "https://staging.offchain-manager.namespace.ninja";

async function getENSData(address: string): Promise<Record<string, string> | null> {
  const label    = address.slice(2, 10).toLowerCase();
  const fullName = `${label}.composia.eth`;

  try {
    const res = await fetch(`${NAMESPACE_API}/api/v1/subnames/${fullName}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;

    const data = await res.json() as { texts?: Record<string, string> };
    const texts = data.texts ?? {};

    if (Object.keys(texts).length === 0) return null;
    return { ...texts, ensName: fullName };
  } catch {
    return null;
  }
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Stable preview data so the same address always shows the same "joined" date
function previewCoreData(address: string) {
  // Seed a plausible joinedAt from the address (3 months back ± some days)
  const seed = parseInt(address.slice(2, 10), 16);
  const threeMonthsAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
  const joinedAt = threeMonthsAgo - (seed % (30 * 86400));
  const accuracy = 70 + (seed % 30);        // 70–99
  const verifications = 200 + (seed % 800); // 200–999
  return { accuracy, verifications, joinedAt };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const registryConfigured = !!(
    process.env.COMPOSIA_REGISTRY_ADDRESS &&
    process.env.COMPOSIA_REGISTRY_ADDRESS !== "0x..."
  );

  const data = registryConfigured ? await getAgentFromRegistry(address) : null;

  // Preview mode: no real registry → synthesise a full demo profile
  if (!data || data.upAddress === ZERO_ADDRESS) {
    if (!registryConfigured || req.nextUrl.searchParams.get("preview") === "true") {
      const core = previewCoreData(address);
      const now = Math.floor(Date.now() / 1000);
      const extended = generateMockExtendedData(address, core);
      const correct = Math.round((core.accuracy / 100) * core.verifications);
      const previewProfile: AgentProfile = {
        agentAddress: address,
        upAddress: null,
        kmAddress: null,
        reputation: {
          accuracy: core.accuracy,
          verifications: core.verifications,
          correct,
          lastUpdated: now - 3600,
          joinedAt: core.joinedAt,
          synced: false,
          ...extended,
        },
        syncedChains: [
          {
            name: "Lukso Testnet",
            chainId: 4201,
            accuracy: core.accuracy,
            verifications: core.verifications,
            receivedAt: now - 3600,
            synced: false,
          },
        ],
      };
      return NextResponse.json(previewProfile);
    }
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const syncedChains: ChainStatus[] = [
    {
      name: "Lukso Testnet",
      chainId: 4201,
      accuracy: data.accuracy,
      verifications: data.verifications,
      receivedAt: data.lastUpdated,
      synced: true,
    },
  ];

  const sepoliaAddress = process.env.SYNCER_ETHEREUM_ADDRESS;
  const sepoliaRpc     = process.env.ETHEREUM_SEPOLIA_RPC;
  if (sepoliaAddress && sepoliaRpc) {
    const sepoliaData = await getSyncerReputation(address, sepoliaAddress, sepoliaRpc);
    syncedChains.push({
      name: "Ethereum Sepolia",
      chainId: 11155111,
      accuracy:      sepoliaData?.accuracy      ?? null,
      verifications: sepoliaData?.verifications ?? null,
      receivedAt:    sepoliaData?.receivedAt    ?? null,
      synced:       (sepoliaData?.receivedAt    ?? 0) > 0,
    });
  }

  const correct = Math.round((data.accuracy / 100) * data.verifications);
  const extended = generateMockExtendedData(address, {
    accuracy:      data.accuracy,
    verifications: data.verifications,
    joinedAt:      data.joinedAt,
  });

  const [ens] = await Promise.all([getENSData(address)]);

  const keeperEntry = keeperLog
    .getRecent(100)
    .find((e) => e.agent.toLowerCase() === address.toLowerCase() && e.status === "created");

  const profile: AgentProfile & {
    ens?: Record<string, string> | null;
    createdByKeeper: boolean;
    keeperTxHash: string | null;
  } = {
    agentAddress: address,
    upAddress: data.upAddress,
    kmAddress: data.kmAddress ?? null,
    reputation: {
      accuracy:      data.accuracy,
      verifications: data.verifications,
      correct,
      lastUpdated:   data.lastUpdated,
      joinedAt:      data.joinedAt,
      synced:        data.synced,
      ...extended,
    },
    syncedChains,
    ens,
    createdByKeeper: !!keeperEntry,
    keeperTxHash:    keeperEntry?.txHash ?? null,
  };

  return NextResponse.json(profile);
}
