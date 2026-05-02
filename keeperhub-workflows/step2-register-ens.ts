/**
 * KeeperHub Workflow: Step 2 — Register ENS Subdomain
 *
 * Trigger: ComposiaRegistry::ProfileRegistered on LUKSO Testnet (chainId 4201)
 * Action:  POST /api/keeper/register-ens  (Bearer auth)
 *          Creates {hex8}.composia.eth gasless subname + seeds ReputationState on Sepolia.
 *
 * KeeperHub env vars:
 *   COMPOSIA_API_KEY         — Bearer token
 *   NEXT_PUBLIC_APP_URL      — https://composia-frontend.vercel.app
 *   COMPOSIA_REGISTRY_ADDRESS — 0x56e55F143c59D58Da19fa739917E80Edc16aeD09
 */

export const workflow = {
  id:          "composia-step2-register-ens",
  name:        "Composia Step 2 — Register ENS Subdomain",
  description: "On ProfileRegistered, create {hex8}.composia.eth offchain subname and seed ReputationState on Ethereum Sepolia.",

  trigger: {
    type:            "onchainEvent",
    chain:           { id: "lukso-testnet", chainId: 4201 },
    contractAddress: process.env.COMPOSIA_REGISTRY_ADDRESS ?? "0x56e55F143c59D58Da19fa739917E80Edc16aeD09",
    eventSignature:  "ProfileRegistered(address indexed agent, address indexed upAddress)",
  },

  action: {
    type: "httpPost",
    url:  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://composia-frontend.vercel.app"}/api/keeper/register-ens`,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${process.env.COMPOSIA_API_KEY}`,
    },
    body: {
      agent:     "{{event.agent}}",
      upAddress: "{{event.upAddress}}",
    },
  },
};

export default workflow;

// ── Code Plugin snippet ───────────────────────────────────────────────────────
/*
const BASE_URL = "https://composia-frontend.vercel.app";
const API_KEY  = "YOUR_COMPOSIA_API_KEY";

const res = await fetch(`${BASE_URL}/api/keeper/register-ens`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    agent:     {{Trigger.agent}},
    upAddress: {{Trigger.upAddress}},
  }),
});

const data = await res.json();
console.log("register-ens result:", JSON.stringify(data));

if (!res.ok) {
  throw new Error(`register-ens failed (${res.status}): ${data.error ?? res.statusText}`);
}

return data;
*/
