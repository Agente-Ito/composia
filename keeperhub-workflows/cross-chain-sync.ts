/**
 * KeeperHub Workflow: Cross-Chain Sync — LUKSO → Ethereum Sepolia
 *
 * Trigger:  ComposiaRegistry::ReputationUpdated on LUKSO Testnet (chainId 4201)
 * Action:   POST /api/sync  (Bearer auth)
 *           Pushes the updated reputation to SyncerContract on Ethereum Sepolia.
 *
 * Environment variables required in KeeperHub fork:
 *   COMPOSIA_API_KEY   — shared secret for /api/sync auth
 *   NEXT_PUBLIC_APP_URL — base URL of the deployed Composia app
 */
export const workflow = {
  id: "cross-chain-sync",
  name: "Cross-Chain Sync — Lukso → Sepolia",
  description:
    "When ComposiaRegistry emits ReputationUpdated on LUKSO Testnet, " +
    "mirrors the updated reputation scores to SyncerContract on Ethereum Sepolia.",

  trigger: {
    type: "onchainEvent",
    chain: { id: "lukso-testnet", chainId: 4201 },
    contractAddress: process.env.COMPOSIA_REGISTRY_ADDRESS ?? "",
    eventSignature: "ReputationUpdated(address indexed agent, uint96 accuracy, uint96 verifications)",
  },

  action: {
    type: "httpPost",
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/sync`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.COMPOSIA_API_KEY}`,
    },
    body: {},
  },
};

export default workflow;
