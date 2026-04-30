import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const MOCK_GENSYN_ABI = [
  "function simulate(address agent, uint256 accuracy, uint256 verifications) external",
];

// ── POST /api/keeper/simulate ─────────────────────────────────────────────────
// Fires MockGensyn.simulate() on LUKSO — triggers the full KeeperHub pipeline.
// No auth required: this is a demo/test endpoint that fires mock events only.
export async function POST(req: NextRequest) {
  const body          = await req.json().catch(() => ({}));
  const agent: string = body.agent;
  const accuracy      = Math.min(100, Math.max(0, Number(body.accuracy      ?? 95)));
  const verifications = Math.max(0,            Number(body.verifications  ?? 1000));

  if (!agent || !ethers.isAddress(agent)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid agent address" }, { status: 400 });
  }

  const rpc            = process.env.LUKSO_TESTNET_RPC;
  // MockGensyn.simulate() is onlyOwner — owner is the deployer wallet
  const privateKey     = process.env.DEPLOYER_PRIVATE_KEY;
  const gensynAddress  = process.env.MOCK_GENSYN_ADDRESS;

  if (!rpc || !privateKey || !gensynAddress) {
    return NextResponse.json({
      ok: false,
      error: "Not configured (need LUKSO_TESTNET_RPC, DEPLOYER_PRIVATE_KEY, MOCK_GENSYN_ADDRESS)",
    }, { status: 500 });
  }

  try {
    const provider  = new ethers.JsonRpcProvider(rpc);
    const signer    = new ethers.Wallet(privateKey, provider);
    const mockGensyn = new ethers.Contract(gensynAddress, MOCK_GENSYN_ABI, signer);

    const tx      = await mockGensyn.simulate(agent, accuracy, verifications);
    const receipt = await tx.wait();

    return NextResponse.json({
      ok: true,
      txHash: receipt.hash,
      agent,
      accuracy,
      verifications,
      explorer: `https://explorer.execution.testnet.lukso.network/tx/${receipt.hash}`,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
