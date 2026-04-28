import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/keeperhub/auto-config
 * Returns a machine-readable config for KeeperHub fork auto-setup.
 * Public endpoint — no secrets exposed.
 */
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const config = {
    name: "Composia Attestor — KeeperHub Integration",
    version: "1.0.0",
    chains: [
      {
        id: "lukso-testnet",
        chainId: 4201,
        name: "LUKSO Testnet",
        rpc: "https://rpc.testnet.lukso.network",
        explorer: "https://explorer.execution.testnet.lukso.network",
      },
      {
        id: "ethereum-sepolia",
        chainId: 11155111,
        name: "Ethereum Sepolia",
        rpc: "https://rpc.sepolia.org",
        explorer: "https://sepolia.etherscan.io",
      },
    ],
    contracts: {
      "lukso-testnet": {
        composiaRegistry: process.env.COMPOSIA_REGISTRY_ADDRESS ?? "",
        mockGensyn: process.env.MOCK_GENSYN_ADDRESS ?? "",
      },
      "ethereum-sepolia": {
        syncerContract: process.env.SYNCER_ETHEREUM_ADDRESS ?? "",
      },
    },
    endpoints: {
      webhookUrl:   `${base}/api/keeper`,
      conditionUrl: `${base}/api/status`,
      historyUrl:   `${base}/api/keeper/history`,
      autoConfigUrl:`${base}/api/keeperhub/auto-config`,
    },
    auth: {
      header: "Authorization",
      format: "Bearer <COMPOSIA_API_KEY>",
      envVar: "COMPOSIA_API_KEY",
      note:   "Set COMPOSIA_API_KEY in your KeeperHub fork environment variables. Never commit the key.",
    },
    workflows: [
      {
        id: "gensyn-listener-lukso",
        name: "Gensyn Listener — LUKSO",
        trigger: { contract: "MockGensyn", event: "VerificationCompleted", chain: "lukso-testnet" },
        condition: { url: `${base}/api/status`, method: "GET", passWhen: "ok === true" },
        action: { url: `${base}/api/keeper`, method: "POST", body: { action: "run" }, authHeader: true },
      },
      {
        id: "cross-chain-sync",
        name: "Cross-Chain Sync — Lukso → Sepolia",
        trigger: { contract: "ComposiaRegistry", event: "ReputationUpdated", chain: "lukso-testnet" },
        action: { url: `${base}/api/sync`, method: "POST", authHeader: true },
      },
    ],
  };

  return NextResponse.json(config);
}
