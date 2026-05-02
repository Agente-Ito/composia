// KeeperHub Code Plugin — Step 3: Update Reputation & Sync
// Paste into a "Run Code" node that comes after a Blockchain Event trigger.
//
// Trigger: ComposiaRegistry::ReputationUpdated (LUKSO Testnet, chainId 4201)
//   Contract: 0x56e55F143c59D58Da19fa739917E80Edc16aeD09
//   Event:    ReputationUpdated(address indexed agent, uint96 accuracy, uint96 verifications)

const BASE_URL = "https://composia-frontend.vercel.app";
const API_KEY  = "{{Secrets.COMPOSIA_API_KEY}}";

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
