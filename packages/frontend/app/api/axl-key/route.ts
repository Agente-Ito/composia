import { NextResponse } from "next/server";

/**
 * GET /api/axl-key
 *
 * Returns the AXL public key of this Composia oracle node.
 * Clients can use this as an HTTP fallback when ENS resolution is unavailable.
 *
 * The canonical discovery path is via ENS:
 *   ENS.text("composia.eth", "axl:key")
 *
 * This endpoint exists so integrators can bootstrap without an ENS provider.
 */
export async function GET() {
  const key = process.env.AXL_NODE_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "AXL not configured — set AXL_NODE_KEY in environment" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    key,
    ensName: process.env.COMPOSIA_ENS_NAME ?? "composia.eth",
    hint: "Canonical discovery: ENS.text(ensName, 'axl:key')",
  });
}
