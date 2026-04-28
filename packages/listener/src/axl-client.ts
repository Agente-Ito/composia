/**
 * axl-client.ts — Composia AXL Reputation Client
 *
 * Lets any agent query a remote Composia oracle over the Gensyn AXL P2P mesh
 * BEFORE deciding whether to connect to a peer. This is the "consumer" side of
 * the reputation directory — the "service" side lives in axl-service.ts.
 *
 * Usage:
 *   const key    = await resolveAxlKey("composia.eth");   // ENS discovery
 *   const client = new AxlClient("http://127.0.0.1:9012");
 *   const result = await client.queryScore(key!, "0xabc...");
 *   const peers  = await client.discoverPeers(key!, { minScore: 75, limit: 5 });
 */

import { ethers } from "ethers";
import type { PeerInfo } from "./axl-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreResponse {
  correlationId: string;
  type: "score";
  data: ScoreData | null;
  error?: string;
}

export interface ScoreData {
  eoa: string;
  score: number;
  reputationPct: number;
  verified: boolean;
  slashed: boolean;
  followerCount: number;
  ensName: string;
  meetsThreshold: boolean;
  [key: string]: unknown;
}

export interface PeersResponse {
  correlationId: string;
  type: "peers";
  data: PeerInfo[];
  error?: string;
}

interface RawMessage {
  correlationId: string;
  type: string;
  data: unknown;
  error?: string;
}

const POLL_MS = 200;
const TIMEOUT_MS = 10_000;

// ─── AxlClient ────────────────────────────────────────────────────────────────

export class AxlClient {
  /**
   * @param axlApi AXL node HTTP endpoint for THIS agent, e.g. http://127.0.0.1:9012
   */
  constructor(private readonly axlApi: string) {}

  /**
   * Queries the Composia oracle at `targetAxlKey` for the reputation score of
   * an agent identified by their Ethereum EOA address.
   */
  async queryScore(targetAxlKey: string, eoa: string): Promise<ScoreResponse> {
    const correlationId = this._makeId();
    await this._send(targetAxlKey, { type: "get_score", correlationId, eoa });
    return this._waitForResponse(correlationId) as Promise<ScoreResponse>;
  }

  /**
   * Asks the Composia oracle at `targetAxlKey` for a ranked list of trusted
   * peers, filtered by minimum reputation score.
   */
  async discoverPeers(
    targetAxlKey: string,
    options: { minScore?: number; limit?: number } = {}
  ): Promise<PeersResponse> {
    const correlationId = this._makeId();
    await this._send(targetAxlKey, {
      type: "get_peers",
      correlationId,
      min_score: options.minScore ?? 0,
      limit: options.limit ?? 10,
    });
    return this._waitForResponse(correlationId) as Promise<PeersResponse>;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async _send(peerId: string, payload: unknown): Promise<void> {
    await fetch(`${this.axlApi}/send`, {
      method: "POST",
      headers: { "X-Destination-Peer-Id": peerId },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Polls /recv until a message with the matching correlationId arrives or the
   * 10-second timeout is exceeded. Messages for OTHER correlation IDs are
   * silently dropped — in a real deployment each query is a separate AXL node
   * instance, so there is no cross-talk.
   */
  private async _waitForResponse(correlationId: string): Promise<RawMessage> {
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS));

      let res: Response;
      try {
        res = await fetch(`${this.axlApi}/recv`);
      } catch {
        continue; // AXL node not reachable yet — keep polling
      }

      if (res.status !== 200) continue;

      const body = await res.text();
      let msg: RawMessage;
      try {
        msg = JSON.parse(body) as RawMessage;
      } catch {
        continue; // not JSON — not our protocol
      }

      if (msg.correlationId === correlationId) return msg;
    }

    throw new Error(`AXL timeout (${TIMEOUT_MS}ms) waiting for correlationId=${correlationId}`);
  }

  /** Generates a short random correlation ID (no crypto dependency needed). */
  private _makeId(): string {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}

// ─── ENS Discovery ────────────────────────────────────────────────────────────

/**
 * Resolves the AXL public key of a Composia oracle from its ENS name.
 * The key is stored as the `axl:key` text record on the ENS name.
 *
 * Example:
 *   const key = await resolveAxlKey("composia.eth");
 *   // → "a1b2c3d4e5f6..." (64-char hex AXL public key)
 *
 * @param ensName  ENS name to resolve, e.g. "composia.eth"
 * @param rpcUrl   Sepolia RPC endpoint (defaults to ETHEREUM_SEPOLIA_RPC env var)
 * @returns The AXL public key string, or null if not found / not configured.
 */
export async function resolveAxlKey(
  ensName: string,
  rpcUrl?: string
): Promise<string | null> {
  const url = rpcUrl ?? process.env.ETHEREUM_SEPOLIA_RPC;
  if (!url) return null;
  try {
    const provider = new ethers.JsonRpcProvider(url);
    const resolver = await provider.getResolver(ensName);
    if (!resolver) return null;
    return resolver.getText("axl:key");
  } catch {
    return null;
  }
}
