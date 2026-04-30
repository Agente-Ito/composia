"use server";

// NOTE: runKeeperNow is kept as a server action only so the COMPOSIA_API_KEY
// never reaches the client. For simulate, the client calls /api/keeper/simulate
// directly (no sensitive key needed — that endpoint uses DEPLOYER_PRIVATE_KEY
// which lives on the server).

export async function runKeeperNow(): Promise<{
  ok: boolean;
  processed: number;
  error?: string;
}> {
  const apiKey = process.env.COMPOSIA_API_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  let data: { ok?: boolean; results?: { action: string }[]; error?: string };
  try {
    const res = await fetch(`${appUrl}/api/keeper`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "run" }),
      cache: "no-store",
      // Generous timeout for blockchain txs — Next.js default is 30s which is too short
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return { ok: false, processed: 0, error: `HTTP ${res.status}` };
    data = await res.json();
  } catch (err: unknown) {
    return { ok: false, processed: 0, error: err instanceof Error ? err.message : "fetch failed" };
  }

  const processed = (data.results ?? []).filter(
    (r) => r.action === "created" || r.action === "updated"
  ).length;

  return { ok: data.ok ?? false, processed, error: data.error };
}
