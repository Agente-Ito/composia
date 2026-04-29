import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// ─── ERC-8004 Agent Registration File endpoint ────────────────────────────────
// Returns an agent registration file that follows the ERC-8004 "Trustless Agents"
// spec (https://eips.ethereum.org/EIPS/eip-8004), served at the URL stored in
// the `erc8004:agentURI` ENS text record for {hex8}.composia.eth subdomains.
// Consumers (block explorers, wallets, agent directories) can discover and verify
// on-chain reputation by following that text record to this endpoint.

const REPUTATION_STATE_ABI = [
  "function getCurrentStatus(bytes32 node) external view returns (uint256,bool,bool,uint256,uint256,uint256)",
  "function verificationThreshold() external view returns (uint256)",
];

const ERC8004_REGISTRY_ABI = [
  "function getAgentId(address agent) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const label       = address.slice(2, 10).toLowerCase();
  const ensName     = `${label}.composia.eth`;
  const ensNode     = ethers.namehash(ensName);
  const frontendUrl = (process.env.COMPOSIA_FRONTEND_URL || "https://composia.app").replace(/\/$/, "");
  const rpc         = process.env.ETHEREUM_SEPOLIA_RPC;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  const registryAddr = process.env.ERC8004_REGISTRY_ADDRESS;

  // ── Read live reputation from ReputationState.sol (Sepolia) ──────────────────
  let rep: {
    reputationBps: number; reputationPct: number;
    verified: boolean; slashed: boolean;
    followerCount: number; lastUpdated: number;
    threshold: number; meetsThreshold: boolean;
  } | null = null;

  let erc8004AgentId: number | null = null;

  if (rpc) {
    const provider = new ethers.JsonRpcProvider(rpc);

    // Reputation lookup
    if (repStateAddr) {
      try {
        const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, provider);
        const [status, threshold] = await Promise.all([
          repState.getCurrentStatus(ensNode),
          repState.verificationThreshold(),
        ]);
        const bps   = Number(status[0]);
        const thresh = Number(threshold);
        rep = {
          reputationBps: bps,
          reputationPct: bps / 100,
          verified:      Boolean(status[1]),
          slashed:       Boolean(status[2]),
          followerCount: Number(status[4]),
          lastUpdated:   Number(status[5]),
          threshold: thresh,
          meetsThreshold: bps >= thresh,
        };
      } catch {
        // reputation data unavailable — still return identity registration
      }
    }

    // ERC-8004 IdentityRegistry lookup
    if (registryAddr) {
      try {
        const registry = new ethers.Contract(registryAddr, ERC8004_REGISTRY_ABI, provider);
        const id = Number(await registry.getAgentId(address));
        if (id > 0) erc8004AgentId = id;
      } catch {
        // registry not deployed or call failed — omit registrations
      }
    }
  }

  // ── Build ERC-8004 registration file ─────────────────────────────────────────
  const description = rep
    ? `Gensyn ML agent on Composia. Reputation: ${rep.reputationPct.toFixed(1)}%${rep.verified ? " · Verified" : ""}${rep.slashed ? " · Slashed" : ""}. Followers: ${rep.followerCount}.`
    : "Gensyn ML agent registered on Composia — the decentralised reputation directory for AI agents.";

  const registration: Record<string, unknown> = {
    // Identity — MUST fields per ERC-8004 §registration-v1
    type:        "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name:        `Composia Agent ${label}`,
    description,
    image:       `${frontendUrl}/og-agent.png`,
    active:      rep ? !rep.slashed : true,

    // Service endpoints — block explorers / agent clients follow these
    services: [
      {
        name:     "web",
        endpoint: `${frontendUrl}/agent/${address}`,
      },
      {
        name:     "ENS",
        endpoint: ensName,
        version:  "v1",
      },
      ...(process.env.AXL_NODE_KEY
        ? [{ name: "AXL", endpoint: `${frontendUrl}/api/axl-key`, version: "v1" }]
        : []),
    ],

    // Trust model supported: on-chain reputation via ReputationState.sol
    supportedTrust: ["reputation"],

    // Populated when agent has self-registered in ERC8004IdentityRegistry.sol
    registrations: erc8004AgentId !== null && registryAddr
      ? [{
          agentId:       erc8004AgentId,
          agentRegistry: `eip155:11155111:${registryAddr}`,
        }]
      : [],
  };

  // Attach live on-chain reputation data under the `com.composia` namespace
  // (follows ENSIP-5 reverse-DNS key convention for service-specific records)
  if (rep) {
    registration["com.composia.reputation"] = {
      ensName,
      ensNode,
      agentAddress:   address,
      reputationBps:  rep.reputationBps,
      reputationPct:  rep.reputationPct,
      verified:       rep.verified,
      slashed:        rep.slashed,
      followerCount:  rep.followerCount,
      threshold:      rep.threshold,
      meetsThreshold: rep.meetsThreshold,
      lastUpdated:    rep.lastUpdated,
      // CAIP-10 source reference so consumers can verify on-chain
      source:         `eip155:11155111:${repStateAddr}`,
      fetchedAt:      new Date().toISOString(),
    };
  }

  return NextResponse.json(registration, {
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
      // Short TTL — reputation changes frequently
      "Cache-Control":               "public, max-age=60, s-maxage=60",
    },
  });
}
