import { ethers } from "ethers";

// ─── ABIs ──────────────────────────────────────────────────────────────────────

const REGISTRAR_ABI = [
  "function registerSubdomain(string calldata label, address agentEoa, string[] calldata keys, string[] calldata values) external returns (bytes32)",
  "function updateTextRecords(bytes32 node, string[] calldata keys, string[] calldata values) external",
];

const REPUTATION_STATE_ABI = [
  "function updateVerificationStatus(bytes32 node, uint256 newReputation, bool shouldBeVerified) external",
  "function syncFollowerCount(bytes32 node, uint256 count) external",
  "function slashAgent(bytes32 node, uint256 durationSeconds, string calldata reason) external",
  "function restoreAgent(bytes32 node) external",
  "function settleSlash(bytes32 node) external",
  "function isCurrentlyVerified(bytes32 node) external view returns (bool)",
  "function getCurrentStatus(bytes32 node) external view returns (uint256 reputation, bool verified, bool slashed, uint256 slashExpiresAt, uint256 followerCount, uint256 lastUpdated)",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ENSRegistrationParams {
  agentEoa: string;
  peerId: string;
  accuracy: number;      // 0-100 (percentage)
  verifications: number;
  upAddress: string;
  followers: number;     // synced from Lukso LSP26
}

export interface ENSRegistrationResult {
  ensName: string;
  ensNode: string;
  subdomain: string | null;   // tx hash of subdomain registration
  repState: string | null;    // tx hash of ReputationState update
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ensLabel(agentEoa: string): string {
  return agentEoa.slice(2, 10).toLowerCase();
}

function ensNode(agentEoa: string): string {
  return ethers.namehash(`${ensLabel(agentEoa)}.composia.eth`);
}

/** accuracy% → basis points (85 → 8500) */
function toBasisPoints(accuracy: number): number {
  return Math.round(accuracy * 100);
}

function getProvider(): { provider: ethers.JsonRpcProvider; signer: ethers.Wallet } | null {
  const rpc = process.env.ETHEREUM_SEPOLIA_RPC;
  const pk  = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rpc || !pk) return null;
  const provider = new ethers.JsonRpcProvider(rpc);
  const signer   = new ethers.Wallet(pk, provider);
  return { provider, signer };
}

// ─── Layer 1: ENS subdomain + text records ─────────────────────────────────────

/**
 * Registers {hex8}.composia.eth on Sepolia and writes static text records.
 * Returns null silently if not configured — never blocks Lukso UP creation.
 */
export async function registerENSSubdomain(
  params: ENSRegistrationParams
): Promise<ENSRegistrationResult | null> {
  const conn = getProvider();
  const registrarAddr = process.env.ENS_REGISTRAR_ADDRESS;
  if (!conn || !registrarAddr) {
    console.log("[ens-registrar] Not configured (need ETHEREUM_SEPOLIA_RPC, DEPLOYER_PRIVATE_KEY, ENS_REGISTRAR_ADDRESS) — skipping");
    return null;
  }

  const label   = ensLabel(params.agentEoa);
  const ensName = `${label}.composia.eth`;

  // Layer 1: static text records (historical baseline)
  const keys = [
    "gensyn:peerId",
    "gensyn:accuracy",
    "gensyn:verifications",
    "gensyn:up_address",
    "gensyn:followers",
    "gensyn:verified_since",  // historical timestamp — matches IS_VERIFIED fuse intent
    "url",
  ];
  const values = [
    params.peerId,
    String(params.accuracy),
    String(params.verifications),
    params.upAddress,
    String(params.followers),
    String(Math.floor(Date.now() / 1000)), // unix timestamp of first verification
    `https://composia.app/agent/${params.agentEoa}`,
  ];

  let subdomainHash: string | null = null;
  let repStateHash: string | null  = null;

  try {
    const registrar = new ethers.Contract(registrarAddr, REGISTRAR_ABI, conn.signer);
    const tx        = await registrar.registerSubdomain(label, params.agentEoa, keys, values);
    const receipt   = await tx.wait();
    subdomainHash   = receipt.hash;
    console.log(`[ens-registrar] Layer1: registered ${ensName} → ${receipt.hash}`);
  } catch (err) {
    console.error(`[ens-registrar] Layer1 subdomain registration failed for ${ensName}:`, err);
  }

  // Layer 2: reactive state in ReputationState contract
  repStateHash = await _updateReputationState(conn.signer, params);

  if (!subdomainHash && !repStateHash) return null;

  return {
    ensName,
    ensNode:   ethers.namehash(ensName),
    subdomain: subdomainHash,
    repState:  repStateHash,
  };
}

// ─── Layer 2: ReputationState updates ─────────────────────────────────────────

/**
 * Syncs the reactive state after reputation update (e.g. called by keeper).
 * Updates both ENS text records (Layer 1) and ReputationState (Layer 2).
 */
export async function updateENSReputation(
  agentEoa: string,
  accuracy: number,
  verifications: number,
  followers: number
): Promise<{ l1Hash: string | null; l2Hash: string | null }> {
  const conn = getProvider();
  const registrarAddr = process.env.ENS_REGISTRAR_ADDRESS;

  const result = { l1Hash: null as string | null, l2Hash: null as string | null };
  if (!conn) return result;

  const node   = ensNode(agentEoa);
  const repBps = toBasisPoints(accuracy);

  // Layer 1 update (text records)
  if (registrarAddr) {
    try {
      const registrar = new ethers.Contract(registrarAddr, REGISTRAR_ABI, conn.signer);
      const keys   = ["gensyn:accuracy", "gensyn:verifications", "gensyn:followers"];
      const values = [String(accuracy), String(verifications), String(followers)];
      const tx     = await registrar.updateTextRecords(node, keys, values);
      const receipt = await tx.wait();
      result.l1Hash = receipt.hash;
      console.log(`[ens-registrar] Layer1 updated ${ensLabel(agentEoa)}.composia.eth`);
    } catch (err) {
      console.error("[ens-registrar] Layer1 text record update failed:", err);
    }
  }

  // Layer 2 update (ReputationState)
  const params: ENSRegistrationParams = {
    agentEoa,
    peerId: "",
    accuracy,
    verifications,
    upAddress: "",
    followers,
  };
  result.l2Hash = await _updateReputationState(conn.signer, params);

  return result;
}

/**
 * Internal: update ReputationState.updateVerificationStatus + syncFollowerCount.
 * Accuracy is converted to basis points. Returns tx hash or null.
 */
async function _updateReputationState(
  signer: ethers.Wallet,
  params: ENSRegistrationParams
): Promise<string | null> {
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  if (!repStateAddr) return null;

  const node          = ensNode(params.agentEoa);
  const repBps        = toBasisPoints(params.accuracy);
  const shouldVerify  = params.accuracy >= 60; // 60% threshold mirrors contract default

  try {
    const repState = new ethers.Contract(repStateAddr, REPUTATION_STATE_ABI, signer);

    // updateVerificationStatus + syncFollowerCount in parallel
    const [repTx, followerTx] = await Promise.all([
      repState.updateVerificationStatus(node, repBps, shouldVerify),
      repState.syncFollowerCount(node, params.followers),
    ]);

    // Wait for both
    const [repReceipt] = await Promise.all([repTx.wait(), followerTx.wait()]);

    console.log(
      `[ens-registrar] Layer2: node=${node.slice(0, 10)}… rep=${repBps}bps verified=${shouldVerify} followers=${params.followers}`
    );
    return repReceipt.hash;
  } catch (err) {
    console.error("[ens-registrar] Layer2 ReputationState update failed:", err);
    return null;
  }
}

// ─── Read helpers (used by frontend API) ──────────────────────────────────────

export async function readReputationState(agentEoa: string): Promise<{
  reputation: number;
  reputationPct: number;
  verified: boolean;
  slashed: boolean;
  slashExpiresAt: number;
  followerCount: number;
  quorum: number;
  lastUpdated: number;
  ensName: string;
} | null> {
  const rpc         = process.env.ETHEREUM_SEPOLIA_RPC;
  const repStateAddr = process.env.REPUTATION_STATE_ADDRESS;
  if (!rpc || !repStateAddr) return null;

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const repState = new ethers.Contract(repStateAddr, [
      ...REPUTATION_STATE_ABI,
      "function getQuorum(bytes32 node) external view returns (uint256)",
    ], provider);

    const node = ethers.namehash(`${ensLabel(agentEoa)}.composia.eth`);

    const [status, quorum] = await Promise.all([
      repState.getCurrentStatus(node),
      repState.getQuorum(node),
    ]);

    return {
      reputation:    Number(status.reputation),
      reputationPct: Number(status.reputation) / 100,
      verified:      status.verified,
      slashed:       status.slashed,
      slashExpiresAt: Number(status.slashExpiresAt),
      followerCount:  Number(status.followerCount),
      quorum:         Number(quorum),
      lastUpdated:    Number(status.lastUpdated),
      ensName:        `${ensLabel(agentEoa)}.composia.eth`,
    };
  } catch {
    return null;
  }
}
