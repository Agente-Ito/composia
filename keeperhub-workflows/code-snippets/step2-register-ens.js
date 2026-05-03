// KeeperHub Code Plugin — Step 2: Register ENS Subdomain
// Paste into a "Run Code" node that comes after a Blockchain Event trigger.
//
// Trigger: ComposiaRegistry::ProfileRegistered (LUKSO Testnet, chainId 4201)
//   Contract: 0x56e55F143c59D58Da19fa739917E80Edc16aeD09
//   Event:    ProfileRegistered(address indexed agent, address indexed upAddress)

const BASE_URL = "https://composia-frontend.vercel.app";
const API_KEY  = "{{Secrets.COMPOSIA_API_KEY}}";

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
