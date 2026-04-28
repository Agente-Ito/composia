/**
 * axl-service.ts — Composia AXL Reputation Directory
 *
 * Turns this Composia oracle into a P2P reputation directory on the Gensyn AXL
 * mesh. Any AXL peer can query us BEFORE connecting to another agent to check
 * whether that agent is trusted ("LinkedIn for AI agents" discovery layer).
 *
 * Message protocol over AXL:
 *   Request  → { type: "get_score",  correlationId, senderEoa?, eoa }
 *   Request  → { type: "get_peers",  correlationId, senderEoa?, min_score?, limit? }
 *   Response ← { correlationId, type: "score" | "peers" | "error", data, error? }
 *   Push     ← { type: "reputation_update", eoa, score, slashed, verified, ensName, ts }
 *
 * Security:
 *   - Rate limited: 30 requests / 60s per peer ID (evicted after 1h idle)
 *   - Slashed senders rejected when senderEoa is provided
 *   - Senders who haven't met the on-chain threshold are rejected
 *   - Exponential backoff on repeated RPC failures (500ms → 30s cap)
 *
 * Deps: none beyond what the listener already uses (native fetch, ethers).
 */

import { readReputationState } from "./ens-registrar";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;      // sliding 1-minute window
const RATE_LIMIT_MAX_REQUESTS = 30;       // max requests per window per peer
const RATE_LIMIT_PRUNE_MS = 5 * 60_000;  // prune stale entries every 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

interface AXLQuery {
  type: "get_score" | "get_peers";
  correlationId: string;
  /**
   * Optional: sender includes their Ethereum EOA so we can verify them on-chain.
   * If omitted the request is still served — degraded security but no broken compat.
   */
  senderEoa?: string;
  eoa?: string;
  min_score?: number;
  limit?: number;
}

interface AXLResponse {
  correlationId: string;
  type: "score" | "peers" | "error";
  data: unknown;
  error?: string;
}

/** Broadcast message pushed proactively to all known peers when reputation changes. */
export interface ReputationUpdateEvent {
  type: "reputation_update";
  eoa: string;
  score: number;
  slashed: boolean;
  verified: boolean;
  ensName: string;
  ts: number;
}

/** Minimal shape returned by GET /api/agents on the Composia frontend. */
interface AgentListItem {
  agentAddress: string;
  [key: string]: unknown;
}

/** Shape of GET /topology response from AXL node. */
interface TopologyResponse {
  peers: string[];
  our_public_key: string;
  [key: string]: unknown;
}

export interface AxlServiceConfig {
  /** AXL node HTTP endpoint, e.g. http://127.0.0.1:9002 */
  axlApi: string;
  /** Composia frontend URL, e.g. http://localhost:3000 */
  frontendUrl: string;
}

// ─── AxlService ───────────────────────────────────────────────────────────────

export class AxlService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /** Rate limit state: peerId → array of request timestamps in ms. */
  private readonly rateLimits = new Map<string, number[]>();

  /** Consecutive RPC/frontend failure count for exponential backoff. */
  private rpcFailures = 0;

  constructor(private readonly config: AxlServiceConfig) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(() => {
      this._poll().catch(() => {
        // silent — never crash the oracle
      });
    }, POLL_MS);

    // Prune stale rate-limit entries every 5 minutes to prevent memory growth.
    this.pruneTimer = setInterval(() => this._pruneRateLimits(), RATE_LIMIT_PRUNE_MS);

    console.log(`[axl-service] Polling ${this.config.axlApi}/recv every ${POLL_MS}ms`);
  }

  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.pruneTimer !== null) { clearInterval(this.pruneTimer); this.pruneTimer = null; }
    this.running = false;
    console.log("[axl-service] Stopped");
  }

  /**
   * Broadcasts a reputation change to all currently-known AXL peers.
   * Call this from the Gensyn listener whenever an agent's on-chain state changes.
   * Fire-and-forget — failures are logged but never thrown.
   */
  async broadcastReputationUpdate(
    eoa: string,
    state: { reputationPct: number; slashed: boolean; verified: boolean; ensName: string }
  ): Promise<void> {
    const event: ReputationUpdateEvent = {
      type: "reputation_update",
      eoa,
      score: state.reputationPct,
      slashed: state.slashed,
      verified: state.verified,
      ensName: state.ensName,
      ts: Date.now(),
    };
    await this._broadcastToKnownPeers(event).catch((err) => {
      console.warn("[axl-service] Broadcast failed (non-fatal):", err);
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async _poll(): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.config.axlApi}/recv`);
    } catch {
      return; // AXL node not reachable — silently skip
    }

    if (res.status !== 200) return;

    const sender = res.headers.get("X-From-Peer-Id");
    const body = await res.text();
    if (!sender || !body) return;

    // ── Rate limit ────────────────────────────────────────────────────────────
    if (!this._allowRequest(sender)) {
      console.warn(`[axl-service] Rate limit hit for peer ${sender.slice(0, 12)}…`);
      // Drop silently — no response to avoid amplification attacks
      return;
    }

    let query: AXLQuery;
    try {
      query = JSON.parse(body) as AXLQuery;
    } catch {
      return; // not JSON — not our protocol
    }

    if (!query.type || !query.correlationId) return;

    // ── Optional on-chain sender verification ─────────────────────────────────
    if (query.senderEoa) {
      const senderState = await readReputationState(query.senderEoa).catch(() => null);
      if (senderState) {
        if (senderState.slashed) {
          await this._send(sender, {
            correlationId: query.correlationId,
            type: "error",
            data: null,
            error: "sender is slashed — access denied",
          }).catch(() => {});
          return;
        }
        if (!senderState.meetsThreshold) {
          await this._send(sender, {
            correlationId: query.correlationId,
            type: "error",
            data: null,
            error: "sender has not met the on-chain verification threshold",
          }).catch(() => {});
          return;
        }
      }
    }

    const response = await this._handle(query);
    await this._send(sender, response).catch(() => {
      // silent — never crash the oracle
    });
  }

  private async _handle(query: AXLQuery): Promise<AXLResponse> {
    const { correlationId } = query;

    if (query.type === "get_score") {
      if (!query.eoa) {
        return { correlationId, type: "error", data: null, error: "missing eoa" };
      }
      const state = await readReputationState(query.eoa);
      if (state) {
        console.log(`[axl-service] get_score ${query.eoa.slice(0, 10)}… → score=${state.reputationPct}`);
      }
      return { correlationId, type: "score", data: state };
    }

    if (query.type === "get_peers") {
      const minScore = typeof query.min_score === "number" ? query.min_score : 0;
      const limit = Math.min(typeof query.limit === "number" ? query.limit : 10, 20);
      const peers = await this._getPeers(minScore, limit);
      console.log(`[axl-service] get_peers min_score=${minScore} → ${peers.length} result(s)`);
      return { correlationId, type: "peers", data: peers };
    }

    return {
      correlationId,
      type: "error",
      data: null,
      error: `unknown type: ${String(query.type)}`,
    };
  }

  /**
   * Fetches the registered agent list from the Composia frontend then resolves
   * on-chain reputation for each (capped at 20 to limit RPC calls).
   * Applies exponential backoff when the frontend or RPC is unavailable.
   */
  private async _getPeers(minScore: number, limit: number): Promise<PeerInfo[]> {
    // Exponential backoff after repeated failures: 500ms, 1s, 2s, 4s … cap 30s
    if (this.rpcFailures > 0) {
      const delayMs = Math.min(Math.pow(2, this.rpcFailures - 1) * 500, 30_000);
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    let agents: AgentListItem[] = [];
    try {
      const res = await fetch(`${this.config.frontendUrl}/api/agents`, {
        signal: controller.signal,
      });
      if (res.ok) {
        agents = (await res.json()) as AgentListItem[];
        this.rpcFailures = 0; // reset on success
      } else {
        this.rpcFailures++;
      }
    } catch {
      this.rpcFailures++;
      // frontend unavailable — fall through to empty result
    } finally {
      clearTimeout(timeout);
    }

    // Resolve on-chain reputation for up to 20 agents in parallel
    const slice = agents.slice(0, 20);
    const resolved = await Promise.all(
      slice.map(async (a): Promise<PeerInfo | null> => {
        const state = await readReputationState(a.agentAddress).catch(() => {
          this.rpcFailures++;
          return null;
        });
        if (!state) return null;
        return {
          eoa: a.agentAddress,
          score: state.reputationPct,
          ensName: state.ensName,
          verified: state.verified,
          slashed: state.slashed,
          followerCount: state.followerCount,
          meetsThreshold: state.meetsThreshold,
        };
      })
    );

    return resolved
      .filter((r): r is PeerInfo => r !== null && !r.slashed && r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Fetches known peers from /topology and pushes `payload` to each one.
   * Uses Promise.allSettled so one slow/failed peer never blocks the others.
   */
  private async _broadcastToKnownPeers(payload: ReputationUpdateEvent): Promise<void> {
    let topology: TopologyResponse;
    try {
      const res = await fetch(`${this.config.axlApi}/topology`);
      if (!res.ok) return;
      topology = (await res.json()) as TopologyResponse;
    } catch {
      return; // AXL unavailable — skip broadcast
    }

    const peers: string[] = Array.isArray(topology.peers) ? topology.peers : [];
    if (peers.length === 0) return;

    console.log(
      `[axl-service] Broadcasting reputation_update for ${payload.eoa.slice(0, 10)}… → ${peers.length} peer(s)`
    );

    await Promise.allSettled(
      peers.map((peerId) =>
        fetch(`${this.config.axlApi}/send`, {
          method: "POST",
          headers: { "X-Destination-Peer-Id": peerId },
          body: JSON.stringify(payload),
        })
      )
    );
  }

  private async _send(peerId: string, payload: AXLResponse): Promise<void> {
    await fetch(`${this.config.axlApi}/send`, {
      method: "POST",
      headers: { "X-Destination-Peer-Id": peerId },
      body: JSON.stringify(payload),
    });
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────

  /**
   * Returns true if the peer is within the rate limit and records this request.
   * Returns false if the limit is exceeded (caller should drop the request).
   */
  private _allowRequest(peerId: string): boolean {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const recent = (this.rateLimits.get(peerId) ?? []).filter((t) => t > cutoff);
    if (recent.length >= RATE_LIMIT_MAX_REQUESTS) return false;
    recent.push(now);
    this.rateLimits.set(peerId, recent);
    return true;
  }

  /**
   * Deletes entries for peers whose most recent request is older than 1 hour.
   * Called by the prune interval to prevent unbounded Map growth.
   */
  private _pruneRateLimits(): void {
    const cutoff = Date.now() - 60 * 60_000;
    for (const [peerId, timestamps] of this.rateLimits.entries()) {
      if (timestamps.every((t) => t < cutoff)) {
        this.rateLimits.delete(peerId);
      }
    }
    if (this.rateLimits.size > 0) {
      console.log(`[axl-service] Rate limit map pruned, ${this.rateLimits.size} active peer(s)`);
    }
  }
}

// ─── PeerInfo ─────────────────────────────────────────────────────────────────

export interface PeerInfo {
  eoa: string;
  score: number;
  ensName: string;
  verified: boolean;
  slashed: boolean;
  followerCount: number;
  meetsThreshold: boolean;
}
