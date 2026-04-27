import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const ENS_NAME_MANAGER_ABI = [
  "function isLabelAvailable(string calldata label) external view returns (bool)",
];

function isValidLabel(label: string): { valid: boolean; reason?: string } {
  if (!label || label.length < 3) return { valid: false, reason: "Minimum 3 characters" };
  if (label.length > 32) return { valid: false, reason: "Maximum 32 characters" };
  if (label.startsWith("-") || label.endsWith("-")) return { valid: false, reason: "Cannot start or end with a dash" };
  if (!/^[a-z0-9-]+$/.test(label)) return { valid: false, reason: "Only lowercase letters, digits, and dashes" };
  return { valid: true };
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.toLowerCase().trim() ?? "";

  const fmt = isValidLabel(name);
  if (!fmt.valid) {
    return NextResponse.json({ available: false, valid: false, reason: fmt.reason });
  }

  const rpc            = process.env.ETHEREUM_SEPOLIA_RPC;
  const nameManagerAddr = process.env.ENS_NAME_MANAGER_ADDRESS;

  if (!rpc || !nameManagerAddr) {
    return NextResponse.json({ available: null, valid: true, reason: "ENS_NAME_MANAGER_ADDRESS not configured" });
  }

  try {
    const provider    = new ethers.JsonRpcProvider(rpc);
    const nameManager = new ethers.Contract(nameManagerAddr, ENS_NAME_MANAGER_ABI, provider);
    const available   = await nameManager.isLabelAvailable(name);
    return NextResponse.json({ available, valid: true, name, ensName: `${name}.composia.eth` });
  } catch (err) {
    console.error("[check-name] RPC error:", err);
    return NextResponse.json({ available: null, valid: true, reason: "RPC error" }, { status: 502 });
  }
}
