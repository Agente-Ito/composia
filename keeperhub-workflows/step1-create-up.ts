/**
 * KeeperHub Workflow: Step 1 — Create Universal Profile
 *
 * Trigger:   MockGensyn::VerificationCompleted on LUKSO Testnet (chainId 4201)
 * Condition: GET /api/status → ok === true
 * Action:    POST /api/keeper/create-up  (Bearer auth)
 *
 * KeeperHub env vars:
 *   COMPOSIA_API_KEY    — Bearer token for /api/keeper/* endpoints
 *   NEXT_PUBLIC_APP_URL — https://composia-frontend.vercel.app
 *   MOCK_GENSYN_ADDRESS — 0x67793b061BE72EB86E713Ba14Ab0f6Fbb225438e
 */

// ── Workflow definition (plain-object format) ─────────────────────────────────
export const workflow = {
  id:          "composia-step1-create-up",
  name:        "Composia Step 1 — Create Universal Profile",
  description: "On VerificationCompleted, deploy UP + LSP6 KeyManager on LUKSO and register in ComposiaRegistry.",

  trigger: {
    type:            "onchainEvent",
    chain:           { id: "lukso-testnet", chainId: 4201 },
    contractAddress: process.env.MOCK_GENSYN_ADDRESS ?? "0x67793b061BE72EB86E713Ba14Ab0f6Fbb225438e",
    eventSignature:  "VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)",
  },

  condition: {
    type:     "httpGet",
    url:      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://composia-frontend.vercel.app"}/api/status`,
    passWhen: (body: { ok: boolean }) => body.ok === true,
  },

  action: {
    type: "httpPost",
    url:  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://composia-frontend.vercel.app"}/api/keeper/create-up`,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${process.env.COMPOSIA_API_KEY}`,
    },
    // {{event.agent}} etc. resolved by KeeperHub from the emitted event args
    body: {
      agent:         "{{event.agent}}",
      accuracy:      "{{event.accuracy}}",
      verifications: "{{event.verifications}}",
    },
  },
};

export default workflow;

// ── Code Plugin snippet ───────────────────────────────────────────────────────
// Paste this into a KeeperHub "Run Code" node when using the code-based editor.
// Template variables ({{Trigger.agent}} etc.) are resolved by KeeperHub before execution.
// Adjust the node name prefix ("Trigger") to match whatever you named the trigger node.
/*
const BASE_URL = "https://composia-frontend.vercel.app";
const API_KEY  = "YOUR_COMPOSIA_API_KEY";   // store as KeeperHub secret, not hardcoded

const res = await fetch(`${BASE_URL}/api/keeper/create-up`, {
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
console.log("create-up result:", JSON.stringify(data));

if (!res.ok) {
  throw new Error(`create-up failed (${res.status}): ${data.error ?? res.statusText}`);
}

return data;
*/
