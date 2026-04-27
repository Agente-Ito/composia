/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_REGISTRY_ADDRESS: process.env.ATTESTOR_REGISTRY_ADDRESS || "",
    NEXT_PUBLIC_LUKSO_RPC: process.env.LUKSO_TESTNET_RPC || "https://rpc.testnet.lukso.network",
    NEXT_PUBLIC_SEPOLIA_RPC: process.env.ETHEREUM_SEPOLIA_RPC || "",
  },
};

export default nextConfig;
