"use server";

export async function runKeeperNow(): Promise<{
  ok: boolean;
  processed: number;
  error?: string;
}> {
  const apiKey  = process.env.COMPOSIA_API_KEY;
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url     = `${appUrl}/api/keeper`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "run" }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, processed: 0, error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  const processed = (data.results as { action: string }[] | undefined)?.filter(
    (r) => r.action === "created" || r.action === "updated"
  ).length ?? 0;

  return { ok: data.ok ?? false, processed, error: data.error };
}
