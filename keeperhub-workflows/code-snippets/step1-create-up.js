// KeeperHub Code Plugin — Step 1: Create Universal Profile
// Paste into a "Run Code" node that comes after a Blockchain Event trigger.
//
// Trigger: MockGensyn::VerificationCompleted (LUKSO Testnet, chainId 4201)
//   Contract: 0x67793b061BE72EB86E713Ba14Ab0f6Fbb225438e
//   Event:    VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)
//
// ⚠ Replace {{Trigger.xxx}} with the actual node name KeeperHub assigned to your trigger.
// ⚠ Replace API_KEY with a KeeperHub secret variable reference if supported, or paste value.

const BASE_URL = "https://composia-frontend.vercel.app";
const API_KEY  = "{{Secrets.COMPOSIA_API_KEY}}";   // adjust to your KeeperHub secrets syntax

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
