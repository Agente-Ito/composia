/**
 * simulate.ts
 *
 * Demo script: emits a MockGensyn event and (optionally) syncs to Sepolia.
 * Usage:
 *   pnpm hardhat run scripts/simulate.ts --network lukso-testnet
 *
 * Environment variables read from .env.deployed or process.env
 */
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.deployed"), override: true });

const MOCK_GENSYN_ADDRESS  = process.env.MOCK_GENSYN_ADDRESS!;
const SYNCER_ADDRESS       = process.env.SYNCER_ETHEREUM_ADDRESS;
const SEPOLIA_RPC          = process.env.ETHEREUM_SEPOLIA_RPC;
const DEPLOYER_KEY         = process.env.DEPLOYER_PRIVATE_KEY;

// Demo agent values — override with CLI env vars if desired
const DEMO_AGENT       = process.env.DEMO_AGENT       || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const DEMO_ACCURACY    = Number(process.env.DEMO_ACCURACY    || "95");
const DEMO_VERIFICATIONS = Number(process.env.DEMO_VERIFICATIONS || "1000");

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!MOCK_GENSYN_ADDRESS) {
    throw new Error("MOCK_GENSYN_ADDRESS not set. Run deploy-lukso.ts first.");
  }

  const MockGensyn = await ethers.getContractAt("MockGensyn", MOCK_GENSYN_ADDRESS);

  console.log("--- ATTESTOR Demo Simulation ---");
  console.log(`Agent:         ${DEMO_AGENT}`);
  console.log(`Accuracy:      ${DEMO_ACCURACY}%`);
  console.log(`Verifications: ${DEMO_VERIFICATIONS}`);
  console.log("");

  // 1. Emit VerificationCompleted on Lukso
  console.log("1. Emitting MockGensyn.VerificationCompleted on Lukso...");
  const tx = await MockGensyn.simulate(DEMO_AGENT, DEMO_ACCURACY, DEMO_VERIFICATIONS);
  const receipt = await tx.wait();
  console.log(`   TX: ${receipt?.hash}`);
  console.log("   ✓ Event emitted. Listener should now create/update Universal Profile.\n");

  // 2. Optionally sync to Sepolia
  if (SYNCER_ADDRESS && SEPOLIA_RPC && DEPLOYER_KEY) {
    console.log("2. Syncing reputation to Ethereum Sepolia...");
    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const sepoliaSigner   = new ethers.Wallet(DEPLOYER_KEY, sepoliaProvider);

    const SyncerABI = [
      "function receiveMessage(address agent, uint96 accuracy, uint96 verifications) external",
      "function getReputation(address agent) external view returns (uint96, uint96, uint64)",
    ];
    const syncer = new ethers.Contract(SYNCER_ADDRESS, SyncerABI, sepoliaSigner);

    const syncTx = await syncer.receiveMessage(DEMO_AGENT, DEMO_ACCURACY, DEMO_VERIFICATIONS);
    const syncReceipt = await syncTx.wait();
    console.log(`   TX: ${syncReceipt?.hash}`);

    const [acc, verifs, receivedAt] = await syncer.getReputation(DEMO_AGENT);
    console.log(`   ✓ Sepolia now has: accuracy=${acc}%, verifications=${verifs}`);
    console.log(`   Received at: ${new Date(Number(receivedAt) * 1000).toISOString()}\n`);
  } else {
    console.log("2. Sepolia sync skipped (SYNCER_ETHEREUM_ADDRESS / ETHEREUM_SEPOLIA_RPC not set)\n");
  }

  console.log("✓ Simulation complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
