import { NextResponse } from "next/server";
import { getAllAgentsFromRegistry } from "@/lib/contracts";

/**
 * Health + status endpoint.
 * KeeperHub calls this as a Condition check before executing sync workflows.
 *
 * Returns { ok: true, agentCount, unsyncedCount } so KeeperHub can decide
 * whether to proceed (e.g. only sync if unsyncedCount > 0).
 */
export async function GET() {
  try {
    const agents = await getAllAgentsFromRegistry();

    return NextResponse.json({
      ok: true,
      agentCount: agents.length,
      timestamp: new Date().toISOString(),
      contracts: {
        registry:    !!process.env.COMPOSIA_REGISTRY_ADDRESS,
        mockGensyn:  !!process.env.MOCK_GENSYN_ADDRESS,
        syncerSepolia: !!process.env.SYNCER_ETHEREUM_ADDRESS,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      { status: 503 }
    );
  }
}
