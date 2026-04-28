import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { GensynListener, RealGensynListener } from "./gensyn-listener";
import { UPManager } from "./up-manager";
import { makeProcessor } from "./processor";
import { startProcessing, stopProcessing } from "./queue";
import { AxlService } from "./axl-service";
import { readReputationState } from "./ens-registrar";

// Load root .env then .env.deployed (deployed contract addresses override)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.deployed"), override: true });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

// GENSYN_MODE=real  → listen to real Gensyn chain (685685)
// GENSYN_MODE=mock  → listen to MockGensyn on LUKSO (default)
const GENSYN_MODE = process.env.GENSYN_MODE ?? "mock";

async function main() {
  const oracleKey      = requireEnv("COMPOSIA_PRIVATE_KEY");
  const registryAddress = requireEnv("COMPOSIA_REGISTRY_ADDRESS");

  // LUKSO provider for UP management (always needed — UPs live on LUKSO)
  const luksoRpc      = requireEnv("LUKSO_TESTNET_RPC");
  const luksoProvider = new ethers.JsonRpcProvider(luksoRpc);
  const signer        = new ethers.Wallet(oracleKey, luksoProvider);

  console.log("[composia] Starting listener...");
  console.log(`[composia] Mode:            ${GENSYN_MODE}`);
  console.log(`[composia] Composia oracle: ${signer.address}`);
  console.log(`[composia] Registry:        ${registryAddress}`);

  const upManager = new UPManager(registryAddress, signer);

  let listener: GensynListener | RealGensynListener;

  if (GENSYN_MODE === "real") {
    // Real Gensyn chain — Chain ID 685685
    const gensynRpc      = process.env.GENSYN_RPC ?? "https://gensyn-testnet.g.alchemy.com/public";
    const peerContract   = process.env.GENSYN_PEER_CONTRACT ?? "0x7745a8FE4b8D2D2c3BB103F8dCae822746F35Da0";
    const gensynProvider = new ethers.JsonRpcProvider(gensynRpc);

    console.log(`[composia] Gensyn RPC:      ${gensynRpc}`);
    console.log(`[composia] Peer contract:   ${peerContract}`);

    listener = new RealGensynListener(peerContract, gensynProvider);
  } else {
    // Mock mode — MockGensyn on LUKSO testnet
    const mockGensynAddress = requireEnv("MOCK_GENSYN_ADDRESS");
    console.log(`[composia] MockGensyn:      ${mockGensynAddress}`);
    listener = new GensynListener(mockGensynAddress, luksoProvider);
  }

  // AXL reputation directory — Gensyn P2P mesh integration
  let axlService: AxlService | null = null;
  if (process.env.AXL_ENABLED === "true") {
    axlService = new AxlService({
      axlApi: process.env.AXL_API ?? "http://127.0.0.1:9002",
      frontendUrl: process.env.COMPOSIA_FRONTEND_URL ?? "http://localhost:3000",
    });
    axlService.start();
    console.log("[axl] Reputation directory service started");
  }

  // After every successful UP create/update, push the agent's latest on-chain
  // reputation to all connected AXL peers in real time (push model).
  const onAgentUpdate = axlService
    ? (agentEoa: string) => {
        readReputationState(agentEoa)
          .then((state) => {
            if (state && axlService) {
              axlService.broadcastReputationUpdate(agentEoa, state).catch(() => {});
            }
          })
          .catch(() => {}); // non-fatal
      }
    : undefined;

  const processor = makeProcessor(upManager, onAgentUpdate);

  listener.start();
  startProcessing(processor); // non-blocking, returns promise we don't await

  // Graceful shutdown
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);

  function shutdown() {
    console.log("\n[composia] Shutting down...");
    listener.stop();
    stopProcessing();
    axlService?.stop();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[composia] Fatal:", err);
  process.exit(1);
});
