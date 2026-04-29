import { ethers } from "ethers";

// ─── ABIs ──────────────────────────────────────────────────────────────────────

const REGISTRAR_ABI = [
  "function registerSubdomain(string calldata label, address agentEoa, string[] calldata keys, string[] calldata values) external returns (bytes32)",
  "function updateTextRecords(bytes32 node, string[] calldata keys, string[] calldata values) external",
];

const REPUTATION_STATE_ABI = [
  "function registerAgent(address agent, address upAddress, bytes32 ensNode, string calldata label) external",
  "function addENSLabel(address agent, string calldata label) external",
  "function updateVerificationStatus(bytes32 node, uint256 newReputation, bool shouldBeVerified) external",
  "function syncFollowerCount(bytes32 node, uint256 count) external",
  "function slashAgent(bytes32 node, uint256 durationSeconds, string calldata reason) external",
  "function restoreAgent(bytes32 node) external",
  "function settleSlash(bytes32 node) external",
  "function isCurrentlyVerified(bytes32 node) external view returns (bool)",
  "function getCurrentStatus(bytes32 node) external view returns (uint256,bool,bool,uint256,uint256,uint256)",
  "function agentToNode(address agent) external view returns (bytes32)",
  "function agentToUP(address agent) external view returns (address)",
  "function resolveAgent(bytes32 node) external view returns (address agentEoa, address upAddress)",
  "function getAgentLabels(address agent) external view returns (string[] memory)",
  "function getQuorum(bytes32 node) external view returns (uint256)",
  "function verificationThreshold() external view returns (uint256)",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  ensNode: string;
  label: string;
  subdomain: string | null;
  repState: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Label = first 8 hex chars of EOA (without 0x), matches ENSNameManager._autoLabel() */
function autoLabel(agentEoa: string): string {
  return agentEoa.slice(2, 10).toLowerCase();
}

function ensNameFor(label: string): string {
  return `${label}.composia.eth`;
}

/** accuracy (0-100) → basis points (0-10000) */
function toBasisPoints(accuracy: number): number {
  return Math.round(accuracy * 100);
}

function getSignerOrNull(): ethers.Wallet | null {
  const rpc = process.env.ETHEREUM_SEPOLIA_RPC;
  const pk  = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rpc || !pk) return null;
  return new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc));
}

// ─── Layer 1: ENS subdomain creation ──────────────────────────────────────────

/**
 * Registers {hex8}.composia.eth on Sepolia with static text records (Layer 1)
 * and then seeds ReputationState with the agent + reactive state (Layer 2).
 * Returns null silently if env vars are missing — never blocks Lukso UP creation.
 */
export async function registerENSSubdomain(
  params: ENSRegistrationParams
): Promise<ENSRegistrationResult | null> {
  const signer        = getSignerOrNull();
  const registrarAddr = process.env.ENS_REGISTRAR_ADDRESS;
  if (!signer || !registrarAddr) {
    console.log("[ens-registrar] Not configured — skipping (need ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, ENS_REGISTRAR_ADDRESS)");
    return null;
  }

  const label   = autoLabel(params.agentEoa);
  const ensName = ensNameFor(label);
  const ensNode = ethers.namehash(ensName);

  // Layer 1: static text records (historical baseline)
  const frontendUrl = process.env.COMPOSIA_FRONTEND_URL || "https://composia.app";
  const keys = [
    "gensyn:peerId",
    "gensyn:accuracy",
    "gensyn:verifications",
    "gensyn:up_address",
    "gensyn:followers",
    "gensyn:verified_since", // timestamp of first verification — historical anchor
    "url",
    // ERC-8004 / ENSIP-5 standard records for discoverable agent identity
    "name",
    "description",
    "erc8004:agentURI",
  ];
  const values = [
    params.peerId,
    String(params.accuracy),
    String(params.verifications),
    params.upAddress,
    String(params.followers),
    String(Math.floor(Date.now() / 1000)),
    `${frontendUrl}/agent/${params.agentEoa}`,
    // ERC-8004 values
    `Composia Agent ${label}`,
    `Gensyn ML agent. Accuracy: ${params.accuracy}%, Verifications: ${params.verifications}`,
    `${frontendUrl}/api/agent/${params.agentEoa}/erc8004`,
  ];

  let subdomainHash: string | null = null;
  let repStateHash:  string | null = null;

  // Layer 1: register subdomain
  try {
    const registrar = new ethers.Contract(registrarAddr, REGISTRAR_ABI, signer);
    const receipt   = await (await registrar.registerSubdomain(label, params.agentEoa, keys, values)).wait();
    subdomainHash   = receipt.hash;
    console.log(`[ens-registrar] L1: ${ensName} → ${receipt.hash}`);
  } catch (err) {
    console.error(`[ens-registrar] L1 subdomain failed for ${ensName}:`, err);
  }

  // Layer 2: seed ReputationState (registerAgent + updateVerificationStatus + syncFollowers)
  repStateHash = await _seedReputationState(signer, params, ensNode, label);

  if (!subdomainHash && !repStateHash) return null;
  return { ensName, ensNode, label, subdomain: subdomainHash, repState: repStateHash };
}

// ─── Layer 2: ReputationState updates ─────────────────────────────────────────

/**
 * Syncs reputation update to both L1 text records and L2 ReputationState.
 * Called by keeper when an existing agent's reputation changes.
 */
export async function updateENSReputation(
  agentEoa: string,
  accuracy: number,
  verifications: number,
  followers: number
): Promise<{ l1: string | null; l2: string | null }> {
  const signer        = getSignerOrNull();
  const registrarAddr = process.env.ENS_REGISTRAR_ADDRESS;
  const repStateAddr  = process.env.REPUTATION_STATE_ADDRESS;
  const result        = { l1: null as string | null, l2: null as string | null };
  if (!signer) return result;

  const label   = autoLabel(agentEoa);
  const ensNode = ethers.namehash(ensNameFor(label));

  // L1 text records
  if (registrarAddr) {
    try {
      const registrar = new ethers.Contract(registrarAddr, REGISTRAR_ABI, signer);
      const receipt   = await (await registrar.updateTextRecords(
        ensNode,
        ["gensyn:accuracy", "gensyn:verifications", "gensyn:followers", "description"],
        [String(accuracy), String(verifications), String(followers),
         `Gensyn ML agent. Accuracy: ${accuracy}%, Verifications: ${verifications}`]
      )).wait();
      result.l1 = receipt.hash;
    } catch (err) {
      console.error("[ens-registrar] L1 text update failed:", err);
    }
  }

  // L2 ReputationState
  if (repStateAddr) {
    try {
      const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, signer);
      const repBps   = toBasisPoints(accuracy);
      const [repTx, followerTx] = await Promise.all([
        repState.updateVerificationStatus(ensNode, repBps, accuracy >= 60),
        repState.syncFollowerCount(ensNode, followers),
      ]);
      const receipt = await repTx.wait();
      await followerTx.wait();
      result.l2 = receipt.hash;
      console.log(`[ens-registrar] L2 updated: ${label}.composia.eth rep=${repBps}bps followers=${followers}`);
    } catch (err) {
      console.error("[ens-registrar] L2 ReputationState update failed:", err);
    }
  }

  return result;
}

// ─── Internal: seed ReputationState on first registration ─────────────────────

async function _seedReputationState(
  signer: ethers.Wallet,
  params: ENSRegistrationParams,
  ensNode: string,
  label: string
): Promise<string | null> {
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  if (!repStateAddr) return null;

  const repBps   = toBasisPoints(params.accuracy);
  const verified = params.accuracy >= 60;

  try {
    const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, signer);

    // registerAgent + updateVerificationStatus + syncFollowerCount in parallel
    const [regTx, repTx, followerTx] = await Promise.all([
      repState.registerAgent(params.agentEoa, params.upAddress, ensNode, label),
      repState.updateVerificationStatus(ensNode, repBps, verified),
      repState.syncFollowerCount(ensNode, params.followers),
    ]);

    const [regReceipt] = await Promise.all([regTx.wait(), repTx.wait(), followerTx.wait()]);

    console.log(
      `[ens-registrar] L2 seeded: ${label}.composia.eth node=${ensNode.slice(0,10)}… rep=${repBps}bps verified=${verified}`
    );
    return regReceipt.hash;
  } catch (err) {
    console.error("[ens-registrar] L2 ReputationState seed failed:", err);
    return null;
  }
}

// ─── Read helpers (used by frontend API routes) ───────────────────────────────

export async function readReputationState(agentEoa: string): Promise<{
  reputation: number; reputationPct: number; verified: boolean;
  slashed: boolean; slashExpiresAt: number; followerCount: number;
  quorum: number; lastUpdated: number; threshold: number; thresholdPct: number;
  slashTimeRemaining: number; meetsThreshold: boolean;
  ensName: string; ensNode: string; label: string;
  agentLabels: string[];
} | null> {
  const rpc          = process.env.ETHEREUM_SEPOLIA_RPC;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  if (!rpc || !repStateAddr) return null;

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, provider);

    const label   = autoLabel(agentEoa);
    const ensName = ensNameFor(label);
    const node    = ethers.namehash(ensName);

    const [status, quorum, threshold, labels] = await Promise.all([
      repState.getCurrentStatus(node),
      repState.getQuorum(node),
      repState.verificationThreshold(),
      repState.getAgentLabels(agentEoa).catch(() => [label]),
    ]);

    const rep       = Number(status[0]);
    const thresh    = Number(threshold);
    const expiresAt = Number(status[3]);

    return {
      reputation: rep, reputationPct: rep / 100,
      verified: status[1], slashed: status[2],
      slashExpiresAt: expiresAt, followerCount: Number(status[4]),
      quorum: Number(quorum), lastUpdated: Number(status[5]),
      threshold: thresh, thresholdPct: thresh / 100,
      slashTimeRemaining: status[2] && expiresAt > 0
        ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : 0,
      meetsThreshold: rep >= thresh,
      ensName, ensNode: node, label,
      agentLabels: Array.isArray(labels) ? labels : [label],
    };
  } catch {
    return null;
  }
}
