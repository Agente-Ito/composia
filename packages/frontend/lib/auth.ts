import { NextRequest } from "next/server";

/**
 * Validates the KeeperHub (or any trusted caller) API key.
 * Set COMPOSIA_API_KEY in .env — KeeperHub sends it as Bearer token.
 */
export function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.COMPOSIA_API_KEY;
  // If no key is configured, allow all (useful for local dev)
  if (!apiKey) return true;

  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${apiKey}`;
}
