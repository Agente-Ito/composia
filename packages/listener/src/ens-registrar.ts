import { ethers } from "ethers";
import {
  autoLabel,
  ensNameFor,
  createAgentSubname,
  updateAgentMetadata,
} from "./namespace-client";

// ─── ABI ───────────────────────────────────────────────────────────────────────

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
  /** Namespace subname label if creation succeeded, null otherwise */
  namespace: string | null;
  repState: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Layer 1: Namespace subname creation (gasless) ────────────────────────────

/**
 * Registers {hex8}.composia.eth via Namespace SDK (Layer 1, gasless)
 * and seeds ReputationState on-chain (Layer 2, one-time gas).
 * Returns null silently if env vars are missing — never blocks Lukso UP creation.
 */
export async function registerENSSubdomain(
  params: ENSRegistrationParams
): Promise<ENSRegistrationResult | null> {
  const label   = autoLabel(params.agentEoa);
  const ensName = ensNameFor(label);
  const ensNode = ethers.namehash(ensName);

  // Layer 1: create offchain subname via Namespace SDK (gasless)
  const namespaceLabel = await createAgentSubname(params);

  // Layer 2: seed ReputationState on-chain (once per agent, gas required)
  const signer = getSignerOrNull();
  const repStateHash = signer
    ? await _seedReputationState(signer, params, ensNode, label)
    : null;

  if (!namespaceLabel && !repStateHash) return null;
  return { ensName, ensNode, label, namespace: namespaceLabel, repState: repStateHash };
}

// ─── Layer 1 + 2: Reputation update ──────────────────────────────────────────

/**
 * Updates reputation metadata:
 *   L1 → gasless text record update via Namespace SDK (every event)
 *   L2 → on-chain ReputationState update via KeeperHub batch (periodic)
 */
export async function updateENSReputation(
  agentEoa: string,
  accuracy: number,
  verifications: number,
  followers: number
): Promise<{ l1: boolean; l2: string | null }> {
  const result = { l1: false, l2: null as string | null };

  // L1: gasless update via Namespace SDK
  result.l1 = await updateAgentMetadata(agentEoa, accuracy, verifications, followers);

  // L2: on-chain ReputationState (batched by KeeperHub — direct call as fallback)
  const signer       = getSignerOrNull();
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  if (signer && repStateAddr) {
    const label   = autoLabel(agentEoa);
    const ensNode = ethers.namehash(ensNameFor(label));
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

    const [regTx, repTx, followerTx] = await Promise.all([
      repState.registerAgent(params.agentEoa, params.upAddress, ensNode, label),
      repState.updateVerificationStatus(ensNode, repBps, verified),
      repState.syncFollowerCount(ensNode, params.followers),
    ]);

    const [regReceipt] = await Promise.all([regTx.wait(), repTx.wait(), followerTx.wait()]);

    console.log(
      `[ens-registrar] L2 seeded: ${label}.composia.eth node=${ensNode.slice(0, 10)}… rep=${repBps}bps verified=${verified}`
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
