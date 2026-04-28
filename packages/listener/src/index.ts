import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { GensynListener } from "./gensyn-listener";
import { UPManager } from "./up-manager";
import { makeProcessor } from "./processor";
import { startProcessing, stopProcessing } from "./queue";

// Load root .env then .env.deployed (deployed contract addresses override)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.deployed"), override: true });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

async function main() {
  const luksoRpc          = requireEnv("LUKSO_TESTNET_RPC");
  const oracleKey       = requireEnv("COMPOSIA_PRIVATE_KEY");
  const mockGensynAddress = requireEnv("MOCK_GENSYN_ADDRESS");
  const registryAddress   = requireEnv("COMPOSIA_REGISTRY_ADDRESS");

  const provider = new ethers.JsonRpcProvider(luksoRpc);
  const signer   = new ethers.Wallet(oracleKey, provider);

  console.log("[composia] Starting listener...");
  console.log(`[composia] Composia oracle: ${signer.address}`);
  console.log(`[composia] MockGensyn:      ${mockGensynAddress}`);
  console.log(`[composia] Registry:        ${registryAddress}`);

  const upManager = new UPManager(registryAddress, signer);
  const processor = makeProcessor(upManager);
  const listener  = new GensynListener(mockGensynAddress, provider);

  listener.start();
  startProcessing(processor); // non-blocking, returns promise we don't await

  // Graceful shutdown
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);

  function shutdown() {
    console.log("\n[composia] Shutting down...");
    listener.stop();
    stopProcessing();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[composia] Fatal:", err);
  process.exit(1);
});
