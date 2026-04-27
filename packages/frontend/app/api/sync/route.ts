import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAllAgentsFromRegistry, getAgentFromRegistry } from "@/lib/contracts";
import { isAuthorized } from "@/lib/auth";

const SYNCER_ABI = [
  "function receiveBatch(address[] calldata agents, uint96[] calldata accuracies, uint96[] calldata verificationCounts) external",
];

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sepoliaAddress = process.env.SYNCER_ETHEREUM_ADDRESS;
  const sepoliaRpc     = process.env.ETHEREUM_SEPOLIA_RPC;
  const privateKey     = process.env.DEPLOYER_PRIVATE_KEY;

  if (!sepoliaAddress || !sepoliaRpc || !privateKey) {
    return NextResponse.json(
      { success: false, error: "Sepolia syncer not configured" },
      { status: 503 }
    );
  }

  try {
    // Collect all agents with unsynced data (or sync all for demo)
    const agents = await getAllAgentsFromRegistry();
    if (agents.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: "No agents to sync" });
    }

    const agentData = await Promise.all(agents.map((a) => getAgentFromRegistry(a)));
    const valid = agentData
      .map((d, i) => ({ ...d!, address: agents[i] }))
      .filter((d) => d && d.upAddress !== "0x0000000000000000000000000000000000000000");

    const addresses    = valid.map((d) => d.address);
    const accuracies   = valid.map((d) => d.accuracy);
    const verifications = valid.map((d) => d.verifications);

    const provider = new ethers.JsonRpcProvider(sepoliaRpc);
    const signer   = new ethers.Wallet(privateKey, provider);
    const syncer   = new ethers.Contract(sepoliaAddress, SYNCER_ABI, signer);

    const tx = await syncer.receiveBatch(addresses, accuracies, verifications);
    const receipt = await tx.wait();

    return NextResponse.json({
      success: true,
      synced: valid.length,
      txHash: receipt.hash,
      agents: addresses,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
