import { ethers } from "hardhat";

// ENS Sepolia canonical addresses
const BASE_REGISTRAR_SEPOLIA = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
const NAME_WRAPPER_SEPOLIA   = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER_SEPOLIA = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

const BASE_REGISTRAR_ABI = [
  "function ownerOf(uint256 id) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
];

const NAME_WRAPPER_ABI = [
  "function ownerOf(uint256 id) view returns (address)",
  "function wrapETH2LD(string calldata label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) external returns (uint64 expiry)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Wrapping composia.eth in ENS NameWrapper on Sepolia...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  const label     = "composia";
  const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
  const tokenId   = BigInt(labelHash);

  const baseReg   = new ethers.Contract(BASE_REGISTRAR_SEPOLIA, BASE_REGISTRAR_ABI, deployer);
  const nw        = new ethers.Contract(NAME_WRAPPER_SEPOLIA,   NAME_WRAPPER_ABI,   deployer);

  // Verify deployer owns the name on BaseRegistrar
  const brOwner = await baseReg.ownerOf(tokenId);
  console.log("BaseRegistrar owner:", brOwner);
  if (brOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer does not own composia.eth on BaseRegistrar (owner=${brOwner})`);
  }

  // Check if already wrapped
  try {
    const nwOwner = await nw.ownerOf(tokenId);
    if (nwOwner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("composia.eth is already wrapped in NameWrapper — nothing to do.");
      return;
    }
  } catch {
    // ownerOf reverts if not wrapped
  }

  // Step 1: Approve NameWrapper on BaseRegistrar (if not already)
  const isApproved = await baseReg.isApprovedForAll(deployer.address, NAME_WRAPPER_SEPOLIA);
  if (!isApproved) {
    console.log("Approving NameWrapper on BaseRegistrar...");
    const tx = await baseReg.setApprovalForAll(NAME_WRAPPER_SEPOLIA, true);
    await tx.wait();
    console.log("  setApprovalForAll ✓");
  } else {
    console.log("NameWrapper already approved on BaseRegistrar ✓");
  }

  // Step 2: Wrap ETH 2LD
  console.log("Wrapping composia.eth...");
  const tx = await nw.wrapETH2LD(
    label,
    deployer.address,  // wrappedOwner
    0,                 // ownerControlledFuses — none initially
    PUBLIC_RESOLVER_SEPOLIA
  );
  const receipt = await tx.wait();
  console.log("  wrapETH2LD ✓  tx:", receipt.hash);
  console.log("\ncomposia.eth is now wrapped in the ENS NameWrapper.");
  console.log("You can now run deploy-ens.ts to deploy the Composia ENS stack.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
