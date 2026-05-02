/**
 * KeeperHub Workflow: Step 3 — Update Reputation & Sync
 *
 * Trigger: ComposiaRegistry::ReputationUpdated on LUKSO Testnet (chainId 4201)
 * Action:  POST /api/keeper/update-reputation  (Bearer auth)
 *          Updates ReputationState scores on Ethereum Sepolia + optional SyncerContract record.
 *
 * KeeperHub env vars:
 *   COMPOSIA_API_KEY         — Bearer token
 *   NEXT_PUBLIC_APP_URL      — https://composia-frontend.vercel.app
 *   COMPOSIA_REGISTRY_ADDRESS — 0x56e55F143c59D58Da19fa739917E80Edc16aeD09
 */

export const workflow = {
  id:          "composia-step3-update-reputation",
  name:        "Composia Step 3 — Update Reputation & Sync",
  description: "On ReputationUpdated, update ReputationState on Ethereum Sepolia, sync to SyncerContract, and update offchain ENS text records.",

  trigger: {
    type:            "onchainEvent",
    chain:           { id: "lukso-testnet", chainId: 4201 },
    contractAddress: process.env.COMPOSIA_REGISTRY_ADDRESS ?? "0x56e55F143c59D58Da19fa739917E80Edc16aeD09",
    eventSignature:  "ReputationUpdated(address indexed agent, uint96 accuracy, uint96 verifications)",
  },

  action: {
    type: "httpPost",
    url:  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://composia-frontend.vercel.app"}/api/keeper/update-reputation`,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${process.env.COMPOSIA_API_KEY}`,
    },
    body: {
      agent:         "{{event.agent}}",
      accuracy:      "{{event.accuracy}}",
      verifications: "{{event.verifications}}",
    },
  },
};

export default workflow;

// ── Code Plugin snippet ───────────────────────────────────────────────────────
/*
const BASE_URL = "https://composia-frontend.vercel.app";
const API_KEY  = "YOUR_COMPOSIA_API_KEY";

const res = await fetch(`${BASE_URL}/api/keeper/update-reputation`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    agent:         {{Trigger.agent}},
    accuracy:      {{Trigger.accuracy}},
    verifications: {{Trigger.verifications}},
  }),
});

const data = await res.json();
console.log("update-reputation result:", JSON.stringify(data));

if (!res.ok) {
  throw new Error(`update-reputation failed (${res.status}): ${data.error ?? res.statusText}`);
}

return data;
*/
