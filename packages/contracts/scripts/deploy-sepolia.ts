import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying to Ethereum Sepolia...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy SyncerContract
  // relayer = deployer (for hackathon demo, the script calls receiveMessage directly)
  console.log("Deploying SyncerContract...");
  const SyncerContract = await ethers.getContractFactory("SyncerContract");
  const syncer = await SyncerContract.deploy(
    deployer.address,  // owner
    deployer.address,  // relayer (demo: same as deployer)
    "lukso-testnet"    // sourceChain
  );
  await syncer.waitForDeployment();
  const syncerAddress = await syncer.getAddress();
  console.log("SyncerContract:", syncerAddress);

  // Deploy ERC8004IdentityRegistry
  console.log("\nDeploying ERC8004IdentityRegistry...");
  const ERC8004Registry = await ethers.getContractFactory("ERC8004IdentityRegistry");
  const erc8004Registry = await ERC8004Registry.deploy();
  await erc8004Registry.waitForDeployment();
  const erc8004RegistryAddress = await erc8004Registry.getAddress();
  console.log("ERC8004IdentityRegistry:", erc8004RegistryAddress);

  // Append to .env.deployed
  const envPath = path.resolve(__dirname, "../../../.env.deployed");
  const existing = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";

  const lines = existing
    .split("\n")
    .filter((l) =>
      !l.startsWith("SYNCER_ETHEREUM_ADDRESS=") &&
      !l.startsWith("SYNCER_NETWORK=") &&
      !l.startsWith("ERC8004_REGISTRY_ADDRESS=")
    );

  fs.writeFileSync(
    envPath,
    [
      ...lines,
      `SYNCER_ETHEREUM_ADDRESS=${syncerAddress}`,
      `SYNCER_NETWORK=sepolia`,
      `ERC8004_REGISTRY_ADDRESS=${erc8004RegistryAddress}`,
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );

  console.log("\nAddresses written to .env.deployed");
  console.log("\n✓ Sepolia deployment complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
