import { ethers } from "ethers";
import { Job } from "./queue";

// ─── Standard LSP3 keys ──────────────────────────────────────────────────────
// SupportedStandards:LSP3Profile (magic value that signals this is an LSP3 profile)
const LSP3_SUPPORTED_STANDARDS_KEY =
  "0xeafec4d89fa9619884b60000abe425d64acd861a49b8ddf5c0b6962110481f38";
const LSP3_SUPPORTED_STANDARDS_VALUE =
  "0xabe425d6"; // magic bytes for LSP3Profile interface ID

// LSP3Profile JSON metadata key
const LSP3_PROFILE_KEY = ethers.keccak256(ethers.toUtf8Bytes("LSP3Profile"));

// ERC-8004 agentURI key — stored in ERC725Y so any ERC-8004 client can discover
// the registration file by reading this key from the Universal Profile.
// keccak256("erc8004:agentURI") — value = raw UTF-8 bytes of the URL.
const ERC8004_AGENT_URI_KEY = ethers.keccak256(ethers.toUtf8Bytes("erc8004:agentURI"));

// ─── Custom Gensyn reputation keys ───────────────────────────────────────────
export const LSP3_KEYS = {
  reputation:    ethers.keccak256(ethers.toUtf8Bytes("gensyn:reputation")),
  verifications: ethers.keccak256(ethers.toUtf8Bytes("gensyn:verifications")),
  correct:       ethers.keccak256(ethers.toUtf8Bytes("gensyn:correct")),
  joined:        ethers.keccak256(ethers.toUtf8Bytes("gensyn:joined")),
  lastActivity:  ethers.keccak256(ethers.toUtf8Bytes("gensyn:last_activity")),
} as const;

export interface ReputationPayload {
  keys:   string[];
  values: string[];
}

/**
 * Encode a compact LSP3Profile JSON as VerifiableURI (JSONURL encoding).
 * Format: 0x00006f357c6a + keccak256(json) + utf8(url)
 * For on-chain storage we use a data-url so the full JSON lives on-chain.
 */
function encodeLSP3Profile(agentAddress: string, accuracy: number, verifications: number): string {
  const frontendUrl = (process.env.COMPOSIA_FRONTEND_URL || "https://composia.app").replace(/\/$/, "");
  const profile = {
    LSP3Profile: {
      name: `Gensyn Agent ${agentAddress.slice(0, 6)}`,
      description: `Verified AI agent on Gensyn RL Swarm. Accuracy: ${accuracy}% · Verifications: ${verifications}. Discover via ERC-8004.`,
      links: [
        { title: "View on Composia", url: `${frontendUrl}/agent/${agentAddress}` },
        { title: "ERC-8004 Registration", url: `${frontendUrl}/api/agent/${agentAddress}/erc8004` },
      ],
      profileImage: [],
      backgroundImage: [],
      tags: ["AI Agent", "Gensyn", "RL Swarm", "ERC-8004", "Composia"],
    },
  };

  const jsonBytes = ethers.toUtf8Bytes(JSON.stringify(profile));
  const jsonHash  = ethers.keccak256(jsonBytes);
  // JSONURL prefix: 0x00006f357c6a = verification-function keccak256 + encoding
  const prefix    = "0x00006f357c6a";
  // Store the JSON itself on-chain as a hex data URI
  const dataUri   = "data:application/json;base64," + Buffer.from(jsonBytes).toString("base64");
  const uriBytes  = ethers.toUtf8Bytes(dataUri);

  return ethers.hexlify(ethers.concat([prefix, jsonHash, uriBytes]));
}

/**
 * Encode reputation data from a Job into LSP3-compatible key/value arrays
 * ready to pass to setDataBatch() on the Universal Profile.
 *
 * When joinedAt is supplied (first registration), also writes:
 *  - SupportedStandards:LSP3Profile (makes profile discoverable by UP tools)
 *  - LSP3Profile JSON with name, description, tags
 *  - gensyn:joined timestamp
 */
export function encodeReputation(job: Job, joinedAt?: number): ReputationPayload {
  const now     = Math.floor(Date.now() / 1000);
  const correct = Math.round((job.accuracy / 100) * job.verifications);

  const keys: string[] = [
    LSP3_KEYS.reputation,
    LSP3_KEYS.verifications,
    LSP3_KEYS.correct,
    LSP3_KEYS.lastActivity,
  ];

  const values: string[] = [
    ethers.zeroPadValue(ethers.toBeHex(job.accuracy), 32),
    ethers.zeroPadValue(ethers.toBeHex(job.verifications), 32),
    ethers.zeroPadValue(ethers.toBeHex(correct), 32),
    ethers.zeroPadValue(ethers.toBeHex(now), 32),
  ];

  if (joinedAt !== undefined) {
    const frontendUrl = (process.env.COMPOSIA_FRONTEND_URL || "https://composia.app").replace(/\/$/, "");

    // Standard LSP3 keys (written once on profile creation)
    keys.push(LSP3_SUPPORTED_STANDARDS_KEY);
    values.push(LSP3_SUPPORTED_STANDARDS_VALUE);

    keys.push(LSP3_PROFILE_KEY);
    values.push(encodeLSP3Profile(job.agent, job.accuracy, job.verifications));

    keys.push(LSP3_KEYS.joined);
    values.push(ethers.zeroPadValue(ethers.toBeHex(joinedAt), 32));

    // ERC-8004: store agentURI in ERC725Y — static pointer, live data served by the endpoint
    keys.push(ERC8004_AGENT_URI_KEY);
    values.push(ethers.hexlify(ethers.toUtf8Bytes(`${frontendUrl}/api/agent/${job.agent}/erc8004`)));
  }

  return { keys, values };
}
