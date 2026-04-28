import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying to Lukso testnet...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "LYX\n");

  // 1. Deploy MockGensyn
  console.log("1/2 Deploying MockGensyn...");
  const MockGensyn = await ethers.getContractFactory("MockGensyn");
  const mockGensyn = await MockGensyn.deploy(deployer.address);
  await mockGensyn.waitForDeployment();
  const mockGensynAddress = await mockGensyn.getAddress();
  console.log("   MockGensyn:", mockGensynAddress);

  // 2. Deploy ComposiaRegistry
  //    Deployer is both the owner and the oracle initially.
  //    After setting up the listener wallet, call setOracle(listenerWallet).
  console.log("2/2 Deploying ComposiaRegistry...");
  const ComposiaRegistry = await ethers.getContractFactory("ComposiaRegistry");
  const composiaRegistry = await ComposiaRegistry.deploy(deployer.address, deployer.address);
  await composiaRegistry.waitForDeployment();
  const composiaRegistryAddress = await composiaRegistry.getAddress();
  console.log("   ComposiaRegistry:", composiaRegistryAddress);

  // Write addresses to .env-style file for other packages to consume
  const addresses = {
    MOCK_GENSYN_ADDRESS: mockGensynAddress,
    COMPOSIA_REGISTRY_ADDRESS: composiaRegistryAddress,
    DEPLOYER_ADDRESS: deployer.address,
    NETWORK: "lukso-testnet",
    DEPLOYED_AT: new Date().toISOString(),
  };

  const envPath = path.resolve(__dirname, "../../../.env.deployed");
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";

  const lines = existing
    .split("\n")
    .filter((l) => !Object.keys(addresses).some((k) => l.startsWith(k + "=")));

  const newLines = Object.entries(addresses).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envPath, [...lines, ...newLines].filter(Boolean).join("\n") + "\n");

  console.log("\nAddresses written to .env.deployed");
  console.log("\n✓ Lukso deployment complete!");
  console.log("\nNext steps:");
  console.log("  1. Fund the listener wallet with LYX for gas");
  console.log("  2. Run: cd packages/contracts && pnpm deploy:sepolia");
  console.log("  3. Start the listener: cd packages/listener && pnpm dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
