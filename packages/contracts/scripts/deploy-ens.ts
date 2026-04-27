import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ENS contracts on Ethereum Sepolia (canonical, do not change)
const NAME_WRAPPER_SEPOLIA  = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER_SEPOLIA = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

const NAME_WRAPPER_ABI = [
  "function setApprovalForAll(address operator, bool approved) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ENS registrar to Ethereum Sepolia...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // namehash("composia.eth") — computed with ethers.namehash
  const parentNode = ethers.namehash("composia.eth");
  console.log("composia.eth namehash:", parentNode);

  // 1. Deploy AttestorSubdomainRegistrar
  console.log("1/2 Deploying AttestorSubdomainRegistrar...");
  const Registrar = await ethers.getContractFactory("AttestorSubdomainRegistrar");
  const registrar = await Registrar.deploy(
    deployer.address,
    NAME_WRAPPER_SEPOLIA,
    PUBLIC_RESOLVER_SEPOLIA,
    parentNode
  );
  await registrar.waitForDeployment();
  const registrarAddress = await registrar.getAddress();
  console.log("   AttestorSubdomainRegistrar:", registrarAddress);

  // 2. Approve registrar to operate on deployer's wrapped ENS names
  //    (so it can create subdomains under composia.eth)
  console.log("2/2 Approving registrar in NameWrapper...");
  const nameWrapper = new ethers.Contract(NAME_WRAPPER_SEPOLIA, NAME_WRAPPER_ABI, deployer);
  const tx = await nameWrapper.setApprovalForAll(registrarAddress, true);
  await tx.wait();
  console.log("   NameWrapper.setApprovalForAll ✓");

  // Write to .env.deployed
  const envPath = path.resolve(__dirname, "../../../.env.deployed");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = existing
    .split("\n")
    .filter((l) => !l.startsWith("ENS_REGISTRAR_ADDRESS=") && !l.startsWith("ENS_PARENT_NODE="));

  fs.writeFileSync(
    envPath,
    [
      ...lines,
      `ENS_REGISTRAR_ADDRESS=${registrarAddress}`,
      `ENS_PARENT_NODE=${parentNode}`,
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );

  console.log("\nAddresses written to .env.deployed");
  console.log("\n✓ ENS deployment complete!");
  console.log("\nNext steps:");
  console.log("  1. Add ENS_REGISTRAR_ADDRESS=" + registrarAddress + " to packages/listener/.env and packages/frontend/.env.local");
  console.log("  2. Add ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com (if not already set)");
  console.log("  3. Restart the listener — new UPs will automatically get {hex8}.composia.eth subdomains");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
