import { createOffchainClient, ChainName } from "@namespacesdk/offchain-manager";

const PARENT = "composia.eth";
const MODE   = (process.env.NAMESPACE_MODE ?? "mainnet") as "mainnet" | "sepolia";

// Reads are public (no API key needed); writes require NAMESPACE_API_KEY.
const readClient = createOffchainClient({ mode: MODE });

function getWriteClient() {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) return null;
  const client = createOffchainClient({ mode: MODE });
  client.setApiKey(PARENT, apiKey);
  return client;
}

/** Label = first 8 hex chars of EOA (without 0x) → e.g. "b95b88c2" */
export function autoLabel(agentEoa: string): string {
  return agentEoa.slice(2, 10).toLowerCase();
}

export function ensNameFor(label: string): string {
  return `${label}.${PARENT}`;
}

/**
 * Creates an offchain ENS subname via Namespace SDK (gasless).
 * Returns the label (e.g. "b95b88c2") on success, null if not configured or on error.
 */
export async function createAgentSubname(params: {
  agentEoa: string;
  peerId: string;
  accuracy: number;
  verifications: number;
  upAddress: string;
  followers: number;
}): Promise<string | null> {
  const client = getWriteClient();
  if (!client) {
    console.log("[namespace-client] Not configured — skipping (need NAMESPACE_API_KEY)");
    return null;
  }

  const label = autoLabel(params.agentEoa);
  const frontendUrl = process.env.COMPOSIA_FRONTEND_URL ?? "https://composia.app";

  try {
    await client.createSubname({
      parentName: PARENT,
      label,
      addresses: [{ chain: ChainName.Ethereum, value: params.agentEoa }],
      texts: [
        { key: "gensyn:peerId",         value: params.peerId },
        { key: "gensyn:accuracy",       value: String(params.accuracy) },
        { key: "gensyn:verifications",  value: String(params.verifications) },
        { key: "gensyn:up_address",     value: params.upAddress },
        { key: "gensyn:followers",      value: String(params.followers) },
        { key: "gensyn:verified_since", value: String(Math.floor(Date.now() / 1000)) },
        { key: "gensyn:joined",         value: new Date().toISOString() },
        { key: "url",           value: `${frontendUrl}/agent/${params.agentEoa}` },
        { key: "name",          value: `Composia Agent ${label}` },
        { key: "description",   value: `Gensyn ML agent. Accuracy: ${params.accuracy}%, Verifications: ${params.verifications}` },
        { key: "erc8004:agentURI", value: `${frontendUrl}/api/agent/${params.agentEoa}/erc8004` },
      ],
    });
    console.log(`[namespace-client] Created ${label}.${PARENT}`);
    return label;
  } catch (err) {
    console.error(`[namespace-client] createSubname failed for ${label}:`, err);
    return null;
  }
}

/**
 * Updates reputation metadata for an existing subname (gasless).
 * Called by the listener on every verification event; heavy-frequency writes go here.
 */
export async function updateAgentMetadata(
  agentEoa: string,
  accuracy: number,
  verifications: number,
  followers: number
): Promise<boolean> {
  const client = getWriteClient();
  if (!client) return false;

  const subname = ensNameFor(autoLabel(agentEoa));
  try {
    await client.updateSubname(subname, {
      texts: [
        { key: "gensyn:accuracy",      value: String(accuracy) },
        { key: "gensyn:verifications", value: String(verifications) },
        { key: "gensyn:followers",     value: String(followers) },
        { key: "gensyn:last_updated",  value: new Date().toISOString() },
        { key: "description", value: `Gensyn ML agent. Accuracy: ${accuracy}%, Verifications: ${verifications}` },
      ],
    });
    console.log(`[namespace-client] Updated ${subname}`);
    return true;
  } catch (err) {
    console.error(`[namespace-client] updateSubname failed for ${subname}:`, err);
    return false;
  }
}

/**
 * Reads all text records for an agent's subname via the public Namespace API.
 * No API key required. Returns null if the subname doesn't exist or on error.
 */
export async function getAgentTextRecords(agentEoa: string): Promise<Record<string, string> | null> {
  const subname = ensNameFor(autoLabel(agentEoa));
  try {
    const records = await readClient.getTextRecords(subname);
    if (!records || Object.keys(records).length === 0) return null;
    return { ...records, ensName: subname };
  } catch {
    return null;
  }
}
