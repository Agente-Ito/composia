import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentFromRegistry, getSyncerReputation } from "@/lib/contracts";
import { generateMockExtendedData } from "@/lib/mock-data";
import { AgentProfile, ChainStatus } from "@/lib/types";

const PUBLIC_RESOLVER_ABI = [
  "function text(bytes32 node, string calldata key) external view returns (string memory)",
];

async function getENSData(address: string): Promise<Record<string, string> | null> {
  const rpc  = process.env.ETHEREUM_SEPOLIA_RPC;
  const addr = process.env.ENS_REGISTRAR_ADDRESS;
  if (!rpc || !addr) return null;

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const resolver = new ethers.Contract(
      "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD",
      PUBLIC_RESOLVER_ABI,
      provider
    );
    const label = address.slice(2, 10).toLowerCase();
    const node  = ethers.namehash(`${label}.composia.eth`);

    const keys = ["gensyn:peerId", "gensyn:accuracy", "gensyn:verifications", "gensyn:up_address", "gensyn:followers", "url"];
    const values = await Promise.all(keys.map((k) => resolver.text(node, k).catch(() => "")));

    const records: Record<string, string> = {};
    keys.forEach((k, i) => { if (values[i]) records[k] = values[i]; });

    if (Object.keys(records).length === 0) return null;
    records["ensName"] = `${label}.composia.eth`;
    return records;
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
    process.env.ATTESTOR_REGISTRY_ADDRESS &&
    process.env.ATTESTOR_REGISTRY_ADDRESS !== "0x..."
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

  const profile: AgentProfile & { ens?: Record<string, string> | null } = {
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
  };

  return NextResponse.json(profile);
}
