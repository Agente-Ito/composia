/**
 * KeeperHub Workflow: Gensyn Listener — LUKSO Testnet
 *
 * Trigger:   MockGensyn::VerificationCompleted on LUKSO Testnet (chainId 4201)
 * Condition: GET /api/status → ok === true
 * Action:    POST /api/keeper { action: "run" }  (Bearer auth)
 *
 * Environment variables required in KeeperHub fork:
 *   COMPOSIA_API_KEY   — shared secret for /api/keeper auth
 *   NEXT_PUBLIC_APP_URL — base URL of the deployed Composia app
 */
export const workflow = {
  id: "gensyn-listener-lukso",
  name: "Gensyn Listener — LUKSO Testnet",
  description:
    "Watches MockGensyn VerificationCompleted events on LUKSO Testnet. " +
    "When an agent meets the quality threshold (accuracy ≥ 80, verifications ≥ 100), " +
    "creates a Universal Profile and registers it in ComposiaRegistry.",

  trigger: {
    type: "onchainEvent",
    chain: { id: "lukso-testnet", chainId: 4201 },
    contractAddress: process.env.MOCK_GENSYN_ADDRESS ?? "",
    eventSignature: "VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)",
  },

  condition: {
    type: "httpGet",
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/status`,
    passWhen: (body: { ok: boolean }) => body.ok === true,
  },

  action: {
    type: "httpPost",
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/keeper`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.COMPOSIA_API_KEY}`,
    },
    body: { action: "run" },
  },
};

export default workflow;
