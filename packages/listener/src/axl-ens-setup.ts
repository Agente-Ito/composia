/**
 * axl-ens-setup.ts — One-time script to register the Composia AXL public key
 * as a text record on the composia.eth ENS name.
 *
 * This enables permissionless key discovery:
 *   ENS.text("composia.eth", "axl:key") → 64-char AXL public key
 *
 * Usage:
 *   AXL_NODE_KEY=<64-char-hex> pnpm ts-node src/axl-ens-setup.ts
 *
 * Required env vars:
 *   ETHEREUM_SEPOLIA_RPC   — Sepolia RPC endpoint
 *   DEPLOYER_PRIVATE_KEY   — wallet that controls composia.eth on Sepolia
 *   AXL_NODE_KEY           — 64-char hex AXL public key (from: GET /topology → our_public_key)
 *
 * Optional env vars:
 *   COMPOSIA_ENS_NAME      — ENS name to set the record on (default: "composia.eth")
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.deployed"), override: true });

// Canonical Sepolia PublicResolver address (ENS v2)
const PUBLIC_RESOLVER_SEPOLIA = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

const PUBLIC_RESOLVER_ABI = [
  "function setText(bytes32 node, string calldata key, string calldata value) external",
  "function text(bytes32 node, string calldata key) external view returns (string)",
];

async function main() {
  const rpc     = process.env.ETHEREUM_SEPOLIA_RPC;
  const pk      = process.env.DEPLOYER_PRIVATE_KEY;
  const axlKey  = process.env.AXL_NODE_KEY;
  const ensName = process.env.COMPOSIA_ENS_NAME ?? "composia.eth";

  if (!rpc || !pk || !axlKey) {
    console.error(
      "[axl-ens-setup] Missing required env vars:\n" +
      "  ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, AXL_NODE_KEY"
    );
    process.exit(1);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(axlKey)) {
    console.error("[axl-ens-setup] AXL_NODE_KEY must be a 64-char hex string");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer   = new ethers.Wallet(pk, provider);
  const resolver = new ethers.Contract(PUBLIC_RESOLVER_SEPOLIA, PUBLIC_RESOLVER_ABI, signer);

  const node = ethers.namehash(ensName);
  console.log(`[axl-ens-setup] Setting axl:key on ${ensName}`);
  console.log(`[axl-ens-setup] ENS node: ${node}`);
  console.log(`[axl-ens-setup] Key:      ${axlKey}`);

  const tx = await (resolver.setText as (
    node: string,
    key: string,
    value: string
  ) => Promise<ethers.ContractTransactionResponse>)(node, "axl:key", axlKey);

  console.log(`[axl-ens-setup] Tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("[axl-ens-setup] Confirmed. Verifying on-chain...");

  const stored = await (resolver.text as (
    node: string,
    key: string
  ) => Promise<string>)(node, "axl:key");

  if (stored === axlKey) {
    console.log(`[axl-ens-setup] ✓ axl:key verified: ${stored}`);
  } else {
    console.error(`[axl-ens-setup] Mismatch! stored="${stored}"`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[axl-ens-setup] Fatal:", err);
  process.exit(1);
});
