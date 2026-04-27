import { ethers } from "ethers";

const REGISTRAR_ABI = [
  "function registerSubdomain(string calldata label, address agentEoa, string[] calldata keys, string[] calldata values) external returns (bytes32)",
  "function updateTextRecords(bytes32 node, string[] calldata keys, string[] calldata values) external",
];

export interface ENSRegistrationParams {
  agentEoa: string;
  peerId: string;
  accuracy: number;
  verifications: number;
  upAddress: string;
  followers: number;
}

export interface ENSRegistrationResult {
  ensName: string;
  txHash: string;
}

/**
 * Registers a {hex8}.composia.eth subdomain on Ethereum Sepolia for a Gensyn agent.
 * Returns null (without throwing) if not configured or if registration fails —
 * ENS failure must never block Lukso UP creation.
 */
export async function registerENSSubdomain(
  params: ENSRegistrationParams
): Promise<ENSRegistrationResult | null> {
  const rpc  = process.env.ETHEREUM_SEPOLIA_RPC;
  const pk   = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.ENS_REGISTRAR_ADDRESS;

  if (!rpc || !pk || !addr) {
    console.log("[ens-registrar] Not configured (need ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, ENS_REGISTRAR_ADDRESS) — skipping");
    return null;
  }

  // Label = first 8 hex chars of the agent EOA (deterministic, collision-resistant enough for demo)
  const label   = params.agentEoa.slice(2, 10).toLowerCase();
  const ensName = `${label}.composia.eth`;

  const keys = [
    "gensyn:peerId",
    "gensyn:accuracy",
    "gensyn:verifications",
    "gensyn:up_address",
    "gensyn:followers",
    "url",
  ];
  const values = [
    params.peerId,
    String(params.accuracy),
    String(params.verifications),
    params.upAddress,
    String(params.followers),
    `https://composia.app/agent/${params.agentEoa}`,
  ];

  try {
    const provider  = new ethers.JsonRpcProvider(rpc);
    const signer    = new ethers.Wallet(pk, provider);
    const registrar = new ethers.Contract(addr, REGISTRAR_ABI, signer);

    const tx      = await registrar.registerSubdomain(label, params.agentEoa, keys, values);
    const receipt = await tx.wait();

    console.log(`[ens-registrar] Registered ${ensName} → ${receipt.hash}`);
    return { ensName, txHash: receipt.hash };
  } catch (err) {
    console.error(`[ens-registrar] Failed to register ${ensName}:`, err);
    return null;
  }
}

/**
 * Updates text records for an existing subdomain after a reputation update.
 */
export async function updateENSReputation(
  agentEoa: string,
  accuracy: number,
  verifications: number,
  followers: number
): Promise<string | null> {
  const rpc  = process.env.ETHEREUM_SEPOLIA_RPC;
  const pk   = process.env.DEPLOYER_PRIVATE_KEY;
  const addr = process.env.ENS_REGISTRAR_ADDRESS;

  if (!rpc || !pk || !addr) return null;

  const label = agentEoa.slice(2, 10).toLowerCase();

  // Compute the node = namehash(`${label}.composia.eth`)
  const node = ethers.namehash(`${label}.composia.eth`);

  const keys   = ["gensyn:accuracy", "gensyn:verifications", "gensyn:followers"];
  const values = [String(accuracy), String(verifications), String(followers)];

  try {
    const provider  = new ethers.JsonRpcProvider(rpc);
    const signer    = new ethers.Wallet(pk, provider);
    const registrar = new ethers.Contract(addr, REGISTRAR_ABI, signer);

    const tx      = await registrar.updateTextRecords(node, keys, values);
    const receipt = await tx.wait();

    console.log(`[ens-registrar] Updated ${label}.composia.eth → ${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error(`[ens-registrar] Failed to update ENS for ${agentEoa}:`, err);
    return null;
  }
}
