import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying to local Hardhat node...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const MockGensyn = await ethers.getContractFactory("MockGensyn");
  const mockGensyn = await MockGensyn.deploy(deployer.address);
  await mockGensyn.waitForDeployment();
  const mockGensynAddress = await mockGensyn.getAddress();
  console.log("MockGensyn:       ", mockGensynAddress);

  const ComposiaRegistry = await ethers.getContractFactory("ComposiaRegistry");
  const registry = await ComposiaRegistry.deploy(deployer.address, deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ComposiaRegistry: ", registryAddress);

  // Hardhat account #0 private key (well-known, safe for local only)
  const deployerKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  // Write to frontend .env.local directly so `pnpm dev` picks it up immediately
  const envPath = path.resolve(__dirname, "../../../packages/frontend/.env.local");
  const lines = [
    `NEXT_PUBLIC_BASE_URL=http://localhost:3000`,
    `LUKSO_TESTNET_RPC=http://localhost:8545`,
    `MOCK_GENSYN_ADDRESS=${mockGensynAddress}`,
    `COMPOSIA_REGISTRY_ADDRESS=${registryAddress}`,
    `DEPLOYER_PRIVATE_KEY=${deployerKey}`,
    `COMPOSIA_PRIVATE_KEY=${deployerKey}`,
  ];
  fs.writeFileSync(envPath, lines.join("\n") + "\n");
  console.log("\n✓ .env.local updated with local addresses");

  // Also write .env.deployed for listener
  const deployedPath = path.resolve(__dirname, "../../../.env.deployed");
  fs.writeFileSync(deployedPath, [
    `MOCK_GENSYN_ADDRESS=${mockGensynAddress}`,
    `COMPOSIA_REGISTRY_ADDRESS=${registryAddress}`,
    `DEPLOYER_PRIVATE_KEY=${deployerKey}`,
    `COMPOSIA_PRIVATE_KEY=${deployerKey}`,
    `LUKSO_TESTNET_RPC=http://localhost:8545`,
    `NETWORK=local`,
    `DEPLOYED_AT=${new Date().toISOString()}`,
  ].join("\n") + "\n");

  console.log("\n✓ Local deployment complete!");
  console.log("\nNext: in another terminal run the frontend:");
  console.log("  cd packages/frontend && pnpm dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
