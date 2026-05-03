/**
 * Namespace offchain subname client for frontend API routes.
 * Writes require NAMESPACE_API_KEY. Reads are public.
 *
 * API: https://offchain-manager.namespace.ninja/api/v1/subnames
 * Auth header: x-auth-token: <apiKey>
 */

const BASE =
  process.env.NAMESPACE_MODE === "sepolia"
    ? "https://staging.offchain-manager.namespace.ninja"
    : "https://offchain-manager.namespace.ninja";

const PARENT   = "composia.eth";
const ETH_COIN = 60; // ENSIP-11 coin type for Ethereum

export function nsLabel(agentEoa: string): string {
  return agentEoa.slice(2, 10).toLowerCase();
}

/** Create a subname with all initial text records (new agent registration). */
export async function nsCreateSubname(params: {
  agentEoa:      string;
  upAddress:     string;
  accuracy:      number;
  verifications: number;
}): Promise<boolean> {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) return false;

  const label      = nsLabel(params.agentEoa);
  const frontendUrl = process.env.COMPOSIA_FRONTEND_URL ?? "https://composia.app";

  const body = {
    label,
    parentName: PARENT,
    addresses:  [{ coin: ETH_COIN, value: params.agentEoa }],
    texts: [
      { key: "gensyn:accuracy",       value: String(params.accuracy) },
      { key: "gensyn:verifications",  value: String(params.verifications) },
      { key: "gensyn:up_address",     value: params.upAddress },
      { key: "gensyn:followers",      value: "0" },
      { key: "gensyn:verified_since", value: String(Math.floor(Date.now() / 1000)) },
      { key: "gensyn:joined",         value: new Date().toISOString() },
      { key: "url",          value: `${frontendUrl}/agent/${params.agentEoa}` },
      { key: "name",         value: `Composia Agent ${label}` },
      { key: "description",  value: `Gensyn ML agent. Accuracy: ${params.accuracy}%, Verifications: ${params.verifications}` },
      { key: "erc8004:agentURI", value: `${frontendUrl}/api/agent/${params.agentEoa}/erc8004` },
    ],
  };

  try {
    const res = await fetch(`${BASE}/api/v1/subnames`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": apiKey },
      body:    JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Update text records for an existing subname.
 * Fetches existing texts first to avoid clearing other records.
 */
export async function nsUpdateTexts(
  agentEoa:      string,
  accuracy:      number,
  verifications: number,
): Promise<boolean> {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) return false;

  const label    = nsLabel(agentEoa);
  const fullName = `${label}.${PARENT}`;

  // GET existing to merge — avoids overwriting unrelated records
  let existingTexts: Record<string, string> = {};
  try {
    const getRes = await fetch(`${BASE}/api/v1/subnames/${fullName}`);
    if (getRes.ok) {
      const data = await getRes.json() as { texts?: Record<string, string> };
      existingTexts = data.texts ?? {};
    }
  } catch { /* start fresh if not found */ }

  const merged = {
    ...existingTexts,
    "gensyn:accuracy":      String(accuracy),
    "gensyn:verifications": String(verifications),
    "gensyn:last_updated":  new Date().toISOString(),
    "description": `Gensyn ML agent. Accuracy: ${accuracy}%, Verifications: ${verifications}`,
  };

  const body = {
    label,
    parentName: PARENT,
    addresses:  [{ coin: ETH_COIN, value: agentEoa }],
    texts: Object.entries(merged).map(([key, value]) => ({ key, value })),
  };

  try {
    const res = await fetch(`${BASE}/api/v1/subnames`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-auth-token": apiKey },
      body:    JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
