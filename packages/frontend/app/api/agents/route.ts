import { NextResponse } from "next/server";
import { getAllAgentsFromRegistry, getAgentFromRegistry } from "@/lib/contracts";

export async function GET() {
  const agents = await getAllAgentsFromRegistry();

  const profiles = await Promise.all(
    agents.map(async (address) => {
      const data = await getAgentFromRegistry(address);
      return {
        agentAddress: address,
        upAddress: data?.upAddress ?? null,
        accuracy: data?.accuracy ?? 0,
        verifications: data?.verifications ?? 0,
        lastUpdated: data?.lastUpdated ?? 0,
        synced: data?.synced ?? false,
      };
    })
  );

  return NextResponse.json({ agents: profiles, total: profiles.length });
}
