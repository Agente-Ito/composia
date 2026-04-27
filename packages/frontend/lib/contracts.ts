import { ethers } from "ethers";

const REGISTRY_ABI = [
  "function agentToUP(address) view returns (address)",
  "function getAgentData(address) view returns (address upAddress, address kmAddress, uint96 accuracy, uint96 verifications, uint64 lastUpdated, bool synced, uint256 joinedAt)",
  "function getAllAgents() view returns (address[])",
  "function agentCount() view returns (uint256)",
];

const SYNCER_ABI = [
  "function getReputation(address) view returns (uint96 accuracy, uint96 verifications, uint64 receivedAt)",
];

const UP_ABI = [
  "function getData(bytes32 dataKey) view returns (bytes memory)",
];

function getProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function getAgentFromRegistry(agentAddress: string) {
  const rpc = process.env.LUKSO_TESTNET_RPC || "https://rpc.testnet.lukso.network";
  const registryAddress = process.env.ATTESTOR_REGISTRY_ADDRESS;

  if (!registryAddress) return null;

  const provider = getProvider(rpc);
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);

  try {
    const data = await registry.getAgentData(agentAddress);
    return {
      upAddress: data.upAddress as string,
      kmAddress: data.kmAddress as string,
      accuracy: Number(data.accuracy),
      verifications: Number(data.verifications),
      lastUpdated: Number(data.lastUpdated),
      synced: data.synced as boolean,
      joinedAt: Number(data.joinedAt),
    };
  } catch {
    return null;
  }
}

export async function getAllAgentsFromRegistry(): Promise<string[]> {
  const rpc = process.env.LUKSO_TESTNET_RPC || "https://rpc.testnet.lukso.network";
  const registryAddress = process.env.ATTESTOR_REGISTRY_ADDRESS;

  if (!registryAddress) return [];

  const provider = getProvider(rpc);
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);

  try {
    return (await registry.getAllAgents()) as string[];
  } catch {
    return [];
  }
}

export async function getSyncerReputation(agentAddress: string, syncerAddress: string, rpcUrl: string) {
  try {
    const provider = getProvider(rpcUrl);
    const syncer = new ethers.Contract(syncerAddress, SYNCER_ABI, provider);
    const [accuracy, verifications, receivedAt] = await syncer.getReputation(agentAddress);
    return {
      accuracy: Number(accuracy),
      verifications: Number(verifications),
      receivedAt: Number(receivedAt),
    };
  } catch {
    return null;
  }
}
