import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { SimulateRequest, SimulateResponse } from "@/lib/types";

interface BatchItem { agent: string; accuracy: number; verifications: number; }

const MOCK_GENSYN_ABI = [
  "function simulate(address agent, uint256 accuracy, uint256 verifications) external",
  "function simulateBatch(address[] calldata agents, uint256[] calldata accuracies, uint256[] calldata verificationCounts) external",
];

function isConfigured() {
  const pk  = process.env.DEPLOYER_PRIVATE_KEY ?? "";
  const addr = process.env.MOCK_GENSYN_ADDRESS  ?? "";
  return pk.length > 10 && pk !== "0x..." && addr.length > 10 && addr !== "0x...";
}

/** Deterministic fake tx hash for preview mode — changes each call so logs differ. */
function fakeTxHash(agent: string): string {
  const salt = Date.now().toString(16);
  return ethers.keccak256(ethers.toUtf8Bytes(agent + salt));
}

export async function POST(req: NextRequest) {
  let body: SimulateRequest & { batch?: BatchItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<SimulateResponse>({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  // ── Batch mode ────────────────────────────────────────────────────────────
  if (body.batch) {
    const items = body.batch;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json<SimulateResponse>({ success: false, error: "batch must be a non-empty array" }, { status: 400 });
    }
    for (const item of items) {
      if (!ethers.isAddress(item.agent)) {
        return NextResponse.json<SimulateResponse>({ success: false, error: `Invalid agent address: ${item.agent}` }, { status: 400 });
      }
    }

    if (!isConfigured()) {
      return NextResponse.json<SimulateResponse>({ success: true, txHash: fakeTxHash("batch"), preview: true });
    }

    const rpc  = process.env.LUKSO_TESTNET_RPC!;
    const pk   = process.env.DEPLOYER_PRIVATE_KEY!;
    const addr = process.env.MOCK_GENSYN_ADDRESS!;

    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const signer   = new ethers.Wallet(pk, provider);
      const contract = new ethers.Contract(addr, MOCK_GENSYN_ABI, signer);

      const agents        = items.map((i) => i.agent);
      const accuracies    = items.map((i) => i.accuracy);
      const verifications = items.map((i) => i.verifications);

      const tx      = await contract.simulateBatch(agents, accuracies, verifications);
      const receipt = await tx.wait();

      return NextResponse.json<SimulateResponse>({ success: true, txHash: receipt.hash });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json<SimulateResponse>({ success: false, error: message }, { status: 500 });
    }
  }

  // ── Single mode ───────────────────────────────────────────────────────────
  const { agent, accuracy, verifications } = body;

  if (!ethers.isAddress(agent)) {
    return NextResponse.json<SimulateResponse>({ success: false, error: "Invalid agent address" }, { status: 400 });
  }
  if (accuracy < 0 || accuracy > 100) {
    return NextResponse.json<SimulateResponse>({ success: false, error: "Accuracy must be 0-100" }, { status: 400 });
  }

  // ── Preview mode: no contracts deployed ──────────────────────────────────
  if (!isConfigured()) {
    return NextResponse.json<SimulateResponse>({
      success: true,
      txHash: fakeTxHash(agent),
      preview: true,
    });
  }

  // ── Live mode: fire real tx on MockGensyn ─────────────────────────────────
  const rpc  = process.env.LUKSO_TESTNET_RPC!;
  const pk   = process.env.DEPLOYER_PRIVATE_KEY!;
  const addr = process.env.MOCK_GENSYN_ADDRESS!;

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const signer   = new ethers.Wallet(pk, provider);
    const contract = new ethers.Contract(addr, MOCK_GENSYN_ABI, signer);

    const tx      = await contract.simulate(agent, accuracy, verifications);
    const receipt = await tx.wait();

    return NextResponse.json<SimulateResponse>({ success: true, txHash: receipt.hash });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json<SimulateResponse>({ success: false, error: message }, { status: 500 });
  }
}
