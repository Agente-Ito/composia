#!/usr/bin/env ts-node
/**
 * axl-demo.ts — Composia AXL P2P Reputation Demo
 *
 * Demonstrates Composia acting as a P2P reputation directory over the Gensyn
 * AXL mesh. Agents query Composia BEFORE connecting to unknown peers, getting
 * back a ranked list of trusted nodes — "LinkedIn for AI agents."
 *
 * ─── Running the demo ────────────────────────────────────────────────────────
 *
 *  Terminal A  (start two AXL nodes — see github.com/gensyn-ai/axl for setup):
 *    ./axl-node --port 9002 --key-file key_a.pem   # Composia oracle
 *    ./axl-node --port 9012 --key-file key_b.pem   # querying agent
 *
 *  Terminal B  (start Composia reputation directory):
 *    AXL_API=http://127.0.0.1:9002 \
 *    COMPOSIA_FRONTEND_URL=http://localhost:3000 \
 *    ts-node src/axl-demo.ts --mode=server
 *
 *    Copy the printed AXL key, then in Terminal C:
 *
 *  Terminal C  (query from a second AXL node):
 *    AXL_API=http://127.0.0.1:9012 \
 *    ts-node src/axl-demo.ts --mode=client --peer=<KEY_FROM_TERMINAL_B> \
 *      --query=get_peers --min-score=0
 *
 *    Or query a specific agent:
 *    ts-node src/axl-demo.ts --mode=client --peer=<KEY> \
 *      --query=get_score --eoa=0xYourAgentEOA
 */

import * as dotenv from "dotenv";
import * as path from "path";

import { AxlService } from "./axl-service";
import { AxlClient } from "./axl-client";
import type { PeerInfo } from "./axl-service";
import type { ScoreData } from "./axl-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.deployed"), override: true });

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (arg.startsWith("--")) {
      args[arg.slice(2)] = "true";
    }
  }
  return args;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreTier(score: number): string {
  if (score >= 90) return "Elite      ⭐⭐⭐";
  if (score >= 75) return "Trustworthy ⭐⭐";
  if (score >= 60) return "Developing  ⭐";
  return "New";
}

/** Reads our own AXL public key from GET /topology */
async function getNodeKey(axlApi: string): Promise<string> {
  const res = await fetch(`${axlApi}/topology`);
  if (!res.ok) throw new Error(`AXL topology endpoint returned ${res.status}`);
  const data = (await res.json()) as { our_public_key?: string };
  if (!data.our_public_key) throw new Error("AXL topology missing our_public_key");
  return data.our_public_key;
}

// ─── Server mode: run Composia as a reputation directory ─────────────────────

async function runServer(axlApi: string, frontendUrl: string): Promise<void> {
  let key = "(could not read — is AXL node running?)";
  try {
    key = await getNodeKey(axlApi);
  } catch {
    // AXL node not ready yet — continue anyway, it will start working once up
  }

  const keyDisplay = key.length >= 64 ? `${key.slice(0, 32)}…${key.slice(-8)}` : key;

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     Composia — AXL Reputation Directory (Gensyn)        ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  AXL endpoint : ${axlApi.padEnd(40)}║`);
  console.log(`║  Your AXL key : ${keyDisplay.padEnd(40)}║`);
  console.log(`║  Agent data   : ${(frontendUrl + "/api/agents").padEnd(40)}║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  Supported queries:                                      ║");
  console.log("║    { type: \"get_score\", correlationId, eoa }             ║");
  console.log("║    { type: \"get_peers\", correlationId, min_score?, limit?}║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  if (key.length === 64) {
    console.log(`Share this key with peers so they can query Composia:\n  ${key}\n`);
  }

  const service = new AxlService({ axlApi, frontendUrl });
  service.start();

  process.on("SIGINT", () => {
    service.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    service.stop();
    process.exit(0);
  });

  // Keep the process alive
  console.log("[axl-demo] Press Ctrl+C to stop.\n");
}

// ─── Client mode: query Composia from a peer node ────────────────────────────

async function runClient(args: Record<string, string>): Promise<void> {
  const axlApi = process.env.AXL_API ?? "http://127.0.0.1:9012";
  const peer = args.peer;
  const query = args.query ?? "get_peers";

  if (!peer) {
    console.error("Error: --peer=<64-char-hex key> is required");
    console.error("  Obtain it by running the server and copying the printed key.");
    process.exit(1);
  }

  const client = new AxlClient(axlApi);

  if (query === "get_score") {
    const eoa = args.eoa;
    if (!eoa) {
      console.error("Error: --eoa=0x... is required for --query=get_score");
      process.exit(1);
    }

    console.log(`\n[axl-demo] Querying Composia reputation for ${eoa}…`);
    let result;
    try {
      result = await client.queryScore(peer, eoa);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[axl-demo] Query failed: ${msg}`);
      process.exit(1);
    }

    if (result.error) {
      console.log(`\n[axl-demo] Error from Composia: ${result.error}`);
    } else if (!result.data) {
      console.log("\n[axl-demo] Agent not found in the Composia registry.");
      console.log("  → Peer is unverified. Proceed with caution.");
    } else {
      const d: ScoreData = result.data as ScoreData;
      console.log("\n┌─ Composia Reputation Report ──────────────────────────┐");
      console.log(`│  EOA        : ${eoa}`);
      console.log(`│  ENS name   : ${d.ensName}`);
      console.log(`│  Score      : ${Math.round(d.reputationPct)} / 100   ${scoreTier(d.reputationPct)}`);
      console.log(`│  Verified   : ${d.verified ? "yes" : "no"}`);
      console.log(`│  Slashed    : ${d.slashed ? "YES — DO NOT CONNECT" : "no"}`);
      console.log(`│  Followers  : ${d.followerCount}`);
      console.log(`│  Meets threshold: ${d.meetsThreshold ? "yes" : "no"}`);
      console.log("└───────────────────────────────────────────────────────┘\n");
    }
  } else {
    // get_peers (default)
    const minScore = Number(args["min-score"] ?? 0);
    const limit = Number(args.limit ?? 10);

    console.log(`\n[axl-demo] Discovering trusted Composia peers (min_score=${minScore}, limit=${limit})…`);
    let result;
    try {
      result = await client.discoverPeers(peer, { minScore, limit });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[axl-demo] Query failed: ${msg}`);
      process.exit(1);
    }

    const peers: PeerInfo[] = result.data ?? [];

    if (peers.length === 0) {
      console.log("[axl-demo] No peers found matching the criteria.");
      console.log("  → Try lowering --min-score or ensure the Composia frontend is running.");
    } else {
      console.log(`\n┌─ Composia Peer Discovery — Top ${peers.length} trusted agent(s) ────────┐`);
      peers.forEach((p, i) => {
        const rank = `#${String(i + 1).padStart(2, " ")}`;
        const score = String(Math.round(p.score)).padStart(3, " ");
        const verified = p.verified ? "✓" : " ";
        console.log(`│  ${rank}  score=${score}  ${verified}  ${p.ensName.padEnd(24)}  ${p.eoa}`);
      });
      console.log("└──────────────────────────────────────────────────────────┘");
      console.log(`\n→ Connect to ${peers[0].eoa} (score ${Math.round(peers[0].score)}, ${peers[0].ensName})`);
      console.log("  AXL key available via: ens text-record axl:key on composia.eth subdomains\n");
    }
  }

  process.exit(0);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const mode = args.mode ?? "client";

  if (mode === "server") {
    const axlApi = process.env.AXL_API ?? "http://127.0.0.1:9002";
    const frontendUrl = process.env.COMPOSIA_FRONTEND_URL ?? "http://localhost:3000";
    await runServer(axlApi, frontendUrl);
  } else {
    await runClient(args);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[axl-demo] Fatal: ${msg}`);
  process.exit(1);
});
