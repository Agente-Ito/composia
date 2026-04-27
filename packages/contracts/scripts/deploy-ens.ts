import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ENS contracts on Ethereum Sepolia (canonical, do not change)
const NAME_WRAPPER_SEPOLIA    = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER_SEPOLIA = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

const NAME_WRAPPER_ABI = [
  "function setApprovalForAll(address operator, bool approved) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ENS stack to Ethereum Sepolia...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const parentNode = ethers.namehash("composia.eth");
  console.log("composia.eth namehash:", parentNode);

  // ── 1. AttestorSubdomainRegistrar (Layer 1 — ENS subdomains + text records) ──
  console.log("\n1/4 Deploying AttestorSubdomainRegistrar...");
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

  // ── 2. Approve Registrar in NameWrapper ──────────────────────────────────────
  console.log("2/4 Approving Registrar in NameWrapper...");
  const nameWrapper = new ethers.Contract(NAME_WRAPPER_SEPOLIA, NAME_WRAPPER_ABI, deployer);
  await (await nameWrapper.setApprovalForAll(registrarAddress, true)).wait();
  console.log("   NameWrapper.setApprovalForAll(Registrar) ✓");

  // ── 3. ReputationState (Layer 2 — reactive state + single source of truth) ───
  console.log("3/4 Deploying ReputationState...");
  const ReputationState = await ethers.getContractFactory("ReputationState");
  const repState = await ReputationState.deploy(
    deployer.address, // owner (governance)
    deployer.address  // oracle (listener wallet — switch to dedicated relayer post-demo)
  );
  await repState.waitForDeployment();
  const repStateAddress = await repState.getAddress();
  console.log("   ReputationState:", repStateAddress);
  console.log("   Verification threshold:", (await repState.verificationThreshold()).toString(), "bps (60%)");

  // ── 4. ENSNameManager (custom names + primary name selection) ─────────────────
  console.log("4/4 Deploying ENSNameManager...");
  const ENSNameManager = await ethers.getContractFactory("ENSNameManager");
  const nameManager = await ENSNameManager.deploy(
    deployer.address,
    registrarAddress,
    repStateAddress
  );
  await nameManager.waitForDeployment();
  const nameManagerAddress = await nameManager.getAddress();
  console.log("   ENSNameManager:", nameManagerAddress);

  // ── Wire: authorize ENSNameManager to call Registrar ─────────────────────────
  console.log("\nWiring authorizations...");
  await (await registrar.setAuthorized(nameManagerAddress, true)).wait();
  console.log("   Registrar.setAuthorized(ENSNameManager) ✓");

  // ── Write all addresses to .env.deployed ─────────────────────────────────────
  const envPath = path.resolve(__dirname, "../../../.env.deployed");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const keys = [
    "ENS_REGISTRAR_ADDRESS",
    "ENS_PARENT_NODE",
    "REPUTATION_STATE_ADDRESS",
    "ENS_NAME_MANAGER_ADDRESS",
  ];
  const filtered = existing.split("\n").filter((l) => !keys.some((k) => l.startsWith(k + "=")));

  fs.writeFileSync(
    envPath,
    [
      ...filtered,
      `ENS_REGISTRAR_ADDRESS=${registrarAddress}`,
      `ENS_PARENT_NODE=${parentNode}`,
      `REPUTATION_STATE_ADDRESS=${repStateAddress}`,
      `ENS_NAME_MANAGER_ADDRESS=${nameManagerAddress}`,
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );

  console.log("\nAll addresses written to .env.deployed");
  console.log("\n✓ ENS stack deployment complete!");
  console.log("\nAdd to packages/listener/.env and packages/frontend/.env.local:");
  console.log(`  ENS_REGISTRAR_ADDRESS=${registrarAddress}`);
  console.log(`  REPUTATION_STATE_ADDRESS=${repStateAddress}`);
  console.log(`  ENS_NAME_MANAGER_ADDRESS=${nameManagerAddress}`);
  console.log(`  ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com`);
  console.log("\nNext steps:");
  console.log("  1. Copy vars above to .env files");
  console.log("  2. Restart listener — new UPs auto-get {hex8}.composia.eth + reactive state");
  console.log("  3. Agents can call ENSNameManager.setCustomName() from their EOA on Sepolia");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
