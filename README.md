# Composia

> **Portable reputation for autonomous AI agents — from Gensyn compute to cross-chain identity.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Composia turns a Gensyn node's raw on-chain statistics into a fully-owned, cross-chain identity. When a Gensyn agent completes a verification round, Composia automatically:

1. Deploys a **LUKSO Universal Profile** (LSP0) — a smart-contract wallet the agent fully owns
2. Registers an **ENS subdomain** (`{agent}.composia.eth`) on Ethereum Sepolia with live reputation text records
3. Persists reactive state in **ReputationState.sol** for DeFi composability (LTV, governance, marketplace)
4. Exposes a **Composia Score** — a 5-component multidimensional reputation (accuracy, consistency, volume, activity, network) replacing a raw accuracy%
5. Publishes an **ERC-8004 agent registration file** (`/api/agent/{address}/erc8004`) so any ERC-8004 compatible directory can discover and verify the agent's on-chain reputation

No manual steps required from the agent. They just compute, and identity follows.

---

## Architecture overview

```
Gensyn chain (LUKSO Testnet)
  └─ MockGensyn::VerificationCompleted(agent, accuracy, verifications)
          │
          ▼
  KeeperHub workflow  ─── OR ───  GensynListener (always-on oracle)
          │
          ▼
  /api/keeper  (Next.js Server Action / POST)
          │
          ├─ Deploy LSP0 UniversalProfile  ──────────────────────────────────┐
          ├─ Deploy LSP6 KeyManager                                          │
          ├─ Write LSP3 reputation keys (gensyn:reputation, verifications…) LUKSO
          ├─ Register in ComposiaRegistry (agentEOA → upAddress + kmAddress) │
          └─ transferOwnership(agent)  ← agent claims via acceptOwnership()  ┘
                    │
                    └─ (Ethereum Sepolia, non-blocking)
                            ├─ Namespace SDK (offchain, gasless)
                            │     └─ {hex8}.composia.eth  ←── ENS NameWrapper
                            │           text records: gensyn:accuracy, verifications, up_address…
                            └─ ReputationState.sol
                                  ├─ registerAgent(eoa, upAddress, node, label)
                                  ├─ updateVerificationStatus(node, repBps, verified)
                                  └─ syncFollowerCount(node, followers)  ←── LSP26
```

---

## Demo vs. production

The core challenge Composia solves is that Gensyn and LUKSO are independent chains — an event on one cannot directly execute code on the other. The bridge is an **oracle**: a process that watches one chain and writes to another.

### How the demo works today

The real Gensyn chain isn't accessible for a hackathon demo, so `MockGensyn.sol` is deployed on **LUKSO testnet itself**. The demo page fires:

```
POST /api/simulate → MockGensyn.simulate(agent, accuracy, verifications) on LUKSO testnet
                          │
                          └─ emits VerificationCompleted on LUKSO testnet
                                    │
                                    ▼
                          KeeperHub detects the event → runs the 3-step workflow
```

Source and destination are the same chain (LUKSO testnet), but the architecture is identical to production — KeeperHub polls `VerificationCompleted`, then calls the API endpoints in sequence to create the UP, register the ENS subdomain, and sync reputation to Sepolia.

### How it would work in production

```
Gensyn chain (685685)
  └─ CumulativeRewardsUpdated(account, peerId, totalRewards)
            │
            │  KeeperHub polls the Gensyn contract
            ▼
  same 3-step workflow → UP on LUKSO → ENS on Sepolia → ReputationState on Sepolia
```

KeeperHub handles the event detection on both sides. The only change from demo to production is replacing `MockGensyn` on LUKSO with the real Gensyn contract on chain 685685 and pointing the KeeperHub trigger at that address.

### The oracle problem

The bridge is currently a **trusted oracle** — the server holding `COMPOSIA_PRIVATE_KEY` writes to LUKSO on behalf of agents, and KeeperHub calls the Composia API endpoints. For an MVP this is a reasonable tradeoff: the oracle can only create and update identity records, never access funds, and agents take full custody after claiming their UP.

The path toward decentralization would require Gensyn to expose a state proof or a cross-chain messaging channel (Hyperlane, Axelar, etc.) that a verifier contract on LUKSO could check trustlessly — not something that exists in Gensyn's current infrastructure. Composia positions itself as that missing bridge layer, with the oracle as a temporary placeholder until the underlying infrastructure matures.

---

## Technology deep-dive

### Gensyn — the reputation source

[Gensyn](https://www.gensyn.ai/) is a decentralised ML compute protocol. Nodes run RL Swarm tasks and emit **`VerificationCompleted(address agent, uint256 accuracy, uint256 verifications)`** events on-chain when a round ends. Composia uses `MockGensyn.sol` on LUKSO Testnet to simulate this event during development; in production the listener subscribes to the real Gensyn contract.

Key data extracted per event:

| Field | Meaning | Used for |
|---|---|---|
| `agent` | EOA of the compute node | UP ownership, ENS label |
| `accuracy` | % of correct answers (0–100) | Composia Score accuracy component |
| `verifications` | Total verified tasks | Score volume + consistency + bayesian confidence |

The **Composia Score** replaces the raw `accuracy%` with a 5-component weighted formula:

```
Composia Score = Accuracy×35% + Consistency×25% + Volume×15% + Activity×15% + Network×10%
```

- **Accuracy (35%)** — Bayesian-adjusted: raw accuracy × `min(1, verifications/100)`. An agent with 95% over 10 verifications scores 47.5, not 95. Needs ≥100 verifications for full confidence.
- **Consistency (25%)** — Career utilization rate (verifications ÷ career days), log-normalized with a 30-day career confidence factor and inactivity penalty. Replaces with real weekly stdDev once per-period history is stored.
- **Volume (15%)** — `log10(verifications + 1) × 20`. Logarithmic scale: 10k verifications → 80 pts, 100k → 100 pts (diminishing returns prevent raw count from dominating).
- **Activity (15%)** — Exponential decay: `100 × e^(−daysSinceLastActivity / 30)`. Half-life ≈ 30 days. Streak bonus +10 for ≥30 consecutive active days.
- **Network (10%)** — LSP26 follower count (log scale, 40%) + average follower reputation (40%) + endorsement ratio (20%).

Score tiers: **Elite ≥90 · Trustworthy ≥75 · Developing ≥60 · New <60**.

---

### LUKSO — identity layer (LSP stack)

[LUKSO](https://lukso.network/) is an EVM-compatible blockchain built for digital identity. Composia uses four LSP standards:

#### LSP0 — Universal Profile (UP)

A smart-contract wallet (`UniversalProfile.sol` from `@lukso/lsp-smart-contracts`) that stores arbitrary ERC725Y key-value metadata. Each Gensyn agent gets one deployed by the Composia oracle wallet.

The UP stores custom Gensyn reputation keys (keccak256-hashed names):

| Key name | Key hash | Value |
|---|---|---|
| `gensyn:reputation` | `keccak256(...)` | Accuracy 0–100, ABI-encoded uint256 |
| `gensyn:verifications` | `keccak256(...)` | Total verified tasks |
| `gensyn:correct` | `keccak256(...)` | Correct answers count |
| `gensyn:joined` | `keccak256(...)` | Unix timestamp of first verification |
| `gensyn:last_activity` | `keccak256(...)` | Unix timestamp of last update |
| `LSP3Profile` | `keccak256("LSP3Profile")` | VerifiableURI → JSON with name, description, links, tags |
| `erc8004:agentURI` | `keccak256("erc8004:agentURI")` | URL of the ERC-8004 `§registration-v1` JSON for this agent |

Ownership transfer flow:
1. Oracle deploys UP → oracle is initial owner
2. Oracle deploys LSP6 KeyManager → becomes UP's owner
3. Oracle calls `KM.execute(UP.transferOwnership(agentEOA))` — agent is now `pendingOwner`
4. Agent calls `UP.acceptOwnership()` from their own wallet → **full self-custody**

After step 4, the oracle has zero control over the UP.

#### LSP6 — Key Manager (KM)

`LSP6KeyManager.sol` sits between callers and the UP, enforcing permission checks. Composia sets two controllers at creation:

| Address | Permissions | Purpose |
|---|---|---|
| Oracle wallet | `SETDATA + SUPER_SETDATA` | Write reputation updates via `KM.execute(UP.setDataBatch(...))` |
| Agent EOA | All permissions | Full self-custody after claim |

The Owner Panel in the frontend lets the UP owner manage controllers, add preset permission bundles (Metadata only / App access / Operator / Full control), and revoke addresses — all via `KM.execute` calls signed from the browser wallet.

#### LSP3 — Profile Metadata

The profile JSON stored on the UP follows the LSP3 schema with `name`, `description`, `profileImage`, `backgroundImage`, `links`, and `tags`. Composia sets tags `["AI Agent", "Gensyn", "RL Swarm", "CreatedByComposia"]` so the profile is discoverable in any LSP3-compatible explorer.

The ProfileEditor in the Owner Panel reads the current `LSP3Profile` VerifiableURI, decodes the base64 JSON, lets the owner edit fields, re-encodes, and writes back via `KM.execute(UP.setDataBatch(...))` — all in-browser with no backend.

#### LSP26 — Follower System

[LSP26](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-26-FollowerSystem.md) is a decentralised follower registry at `0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA` (LUKSO Testnet). Any address can `follow(targetAddress)` or `unfollow(targetAddress)`. Composia uses it for:

- **Composia Score network component** — follower count feeds the network score (10% weight)
- **Follow Agents tab** — lets UP owners follow other Composia agents directly from the Owner Panel; shows real-time follow status with filters (All / Following / Score ≥ 90)
- **ReputationState.sol sync** — the oracle calls `syncFollowerCount(node, count)` on Sepolia so governance quorum reflects LSP26 state cross-chain

No custody of follower data — LSP26 is a standalone on-chain registry independent of Composia.

---

### ENS — identity on Ethereum

All ENS operations use the **canonical Sepolia NameWrapper** and **PublicResolver** at their well-known addresses. Composia does not deploy custom resolver logic.

#### Two-tier name system

| Tier | Example | Created by | How |
|---|---|---|---|
| Auto | `a1b2c3d4.composia.eth` | Oracle (automatic) | Gasless via [Namespace SDK](https://namespace.ninja) |
| Custom | `alice.composia.eth` | Agent (from their EOA) | On-chain via `ENSNameManager.sol` |

The auto name uses the first 8 hex chars of the agent's EOA as the label — always unique, always available.

Auto names are created gaslessly through the **Namespace SDK** (`lib/namespace.ts`), which writes the subname and all text records in a single API call to Namespace's offchain manager. No gas required from the oracle for auto-registration. Custom names use `ENSNameManager.sol` and require the agent to pay gas from their own wallet.

#### NameWrapper and Fuses

ENS NameWrapper wraps `.eth` names into ERC1155 tokens and adds a **fuses** system — a bitmask of capabilities that can be irrevocably burned.

Composia burns the following fuses on each `composia.eth` subdomain:

| Fuse | Value | Effect |
|---|---|---|
| `CANNOT_UNWRAP` | `1` | Prevents the subdomain from being unwrapped back to a legacy name |
| `CANNOT_SET_RESOLVER` | `32` | Locks the PublicResolver in place — agent cannot point to a custom resolver and break text record reads |

These fuses are burned at creation time by the Registrar (which holds the parent `composia.eth` name). The agent still controls the subdomain's records and can transfer it — they just cannot change the resolver or unwrap it. This protects Composia's ability to read reputation records on-chain reliably.

#### Text records (PublicResolver)

The PublicResolver on Sepolia stores key-value text records under each agent's ENS node. Composia writes:

| Key | Value |
|---|---|
| `gensyn:peerId` | Gensyn peer ID |
| `gensyn:accuracy` | Accuracy as a string ("85") |
| `gensyn:verifications` | Verification count |
| `gensyn:up_address` | LUKSO UP address |
| `gensyn:followers` | LSP26 follower count |
| `url` | `https://composia.app/agent/{eoa}` |
| `name` | `Composia Agent {label}` (ENSIP-5 global key) |
| `description` | `Gensyn ML agent. Accuracy: X%, Verifications: N` (updated on every round) |
| `erc8004:agentURI` | `https://composia.app/api/agent/{eoa}/erc8004` |

These records are human-readable (any ENS-compatible app can display them) and machine-readable (Composia's `/api/agent/{address}` API reads them to hydrate the profile page).

#### Custom names (ENSNameManager)

`ENSNameManager.sol` lets verified agents register a second, human-friendly label. The contract:
1. Checks `ReputationState.isRegisteredAgent(msg.sender)` — must be a registered agent
2. Checks label availability (3–32 chars, lowercase alphanumeric + dash)
3. Calls `ComposiaSubdomainRegistrar.createSubdomain(label, agentEOA)` — Composia sponsors gas
4. Stores the custom name as the agent's primary label in `ReputationState`

The auto-generated name remains active. Both names resolve to the same agent. The profile page always displays the primary (custom) name.

---

### ERC-8004 — Trustless Agents identity layer

[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) ("Trustless Agents", draft, MetaMask / Coinbase / Google) defines a standard discovery and registration layer for autonomous AI agents. It specifies:

1. **`§registration-v1` JSON file** — a canonical document describing the agent's identity, services, and trust model, served at a stable URL (`agentURI`)
2. **Identity Registry** — an ERC-721 contract where agents self-register, minting a token whose `tokenURI` points to their registration file
3. **ENS and ERC725Y integration** — agents store their `agentURI` in ENS text records and in Universal Profile ERC725Y key-value storage so any consumer can discover the file

#### What Composia adds

Every Composia agent automatically gets:

| Artifact | Location | Value |
|---|---|---|
| `erc8004:agentURI` ENS text record | Sepolia ENS node | `https://composia.app/api/agent/{eoa}/erc8004` |
| `erc8004:agentURI` ERC725Y key | LUKSO Universal Profile | same URL, stored on-chain as `bytes` |
| Registration file endpoint | Next.js API route | ERC-8004 §registration-v1 compliant JSON |
| Optional identity token | `ERC8004IdentityRegistry.sol` (Sepolia) | Agent self-mints via `/claim` Step 4 |

#### Registration file (`GET /api/agent/{address}/erc8004`)

The endpoint returns a JSON document conforming to ERC-8004 §registration-v1:

```jsonc
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Composia Agent a1b2c3d4",
  "description": "Gensyn ML agent on Composia. Reputation: 87.3% · Verified. Followers: 12.",
  "image": "https://composia.app/og-agent.png",
  "active": true,
  "services": [
    { "name": "web",   "endpoint": "https://composia.app/agent/0x..." },
    { "name": "ENS",   "endpoint": "a1b2c3d4.composia.eth", "version": "v1" }
  ],
  "supportedTrust": ["reputation"],
  "registrations": [
    // populated after agent calls register() in ERC8004IdentityRegistry.sol
    { "agentId": 42, "agentRegistry": "eip155:11155111:0x..." }
  ],
  "com.composia.reputation": {
    "reputationBps": 8730,     // 87.30%
    "verified": true,
    "slashed": false,
    "followerCount": 12,
    "source": "eip155:11155111:0x..."  // CAIP-10 reference to ReputationState.sol
  }
}
```

Cache-Control: `public, max-age=60` — short TTL because reputation changes frequently.

#### ERC8004IdentityRegistry.sol

A minimal ERC-721 + URIStorage contract deployed on Sepolia. Any agent can call `register(agentURI)` to mint their identity token. Composia does not custody agentIds — agents pay their own gas.

```solidity
function register(string calldata agentURI) external returns (uint256 agentId);
function getAgentId(address agent) external view returns (uint256); // 0 = not registered
function totalAgents() external view returns (uint256);
```

#### Claim flow (Step 4 — optional)

After claiming UP ownership on LUKSO (Step 3), agents see an optional Step 4 on the `/claim/{upAddress}` page:
- Wallet switches to **Sepolia**
- Agent calls `ERC8004IdentityRegistry.register(agentURI)` — mints their ERC-8004 identity token (~150k gas)
- `agentId` is parsed from the `Registered` event and displayed
- The API route immediately starts returning `registrations: [{ agentId, agentRegistry }]`

---


### KeeperHub — Automation

[KeeperHub](https://keeperhub.dev/) is a decentralised automation protocol that triggers on-chain actions based on contract events or conditions. Composia uses it as the production trigger mechanism for UP creation.

#### Workflow: Gensyn Listener (LUKSO → Composia)

```yaml
trigger:
  contract: MockGensyn (LUKSO Testnet)
  event: VerificationCompleted(address agent, uint256 accuracy, uint256 verifications)

condition:
  GET /api/status  →  ok === true   # Composia oracle is healthy

action:
  POST /api/keeper
  Authorization: Bearer <COMPOSIA_API_KEY>
  { "action": "run" }
```

The keeper runs eligibility checks before creating UPs: **accuracy ≥ 80** and **verifications ≥ 100** (the Bayesian minimum for meaningful data). Agents below these thresholds are scanned but skipped.

#### Workflow: Cross-Chain Sync (LUKSO → Sepolia)

```yaml
trigger:
  contract: ComposiaRegistry (LUKSO Testnet)
  event: ReputationUpdated(address agent, uint96 accuracy, uint96 verifications)

action:
  POST /api/sync
  Authorization: Bearer <COMPOSIA_API_KEY>
```

Keeps the Sepolia `ReputationState` in sync with LUKSO reputation updates.

#### Self-describing config

`GET /api/keeperhub/auto-config` returns a machine-readable JSON document describing both workflows, all contract addresses, RPC endpoints, and authentication format — so a KeeperHub fork can auto-configure itself by fetching a single URL.

#### Keeper Hub UI (`/keeper`)

The `/keeper` page in the frontend shows:
- Live stats (total runs, created, updated, failed) — polled every 15 seconds
- **Run Now** button — triggers `/api/keeper { action: "run" }` via a Next.js Server Action (the `COMPOSIA_API_KEY` never leaves the server)
- Active workflow definitions (human-readable)
- Execution history with status (✦ Created / ↑ Updated / ✕ Failed), agent address, UP link to LUKSO explorer, and relative timestamps

The in-memory execution log (capped at 100 entries) is exposed at `GET /api/keeper/history` for the frontend to poll. When a keeper creates an agent, the `/api/agent/{address}` response includes `createdByKeeper: true` and the agent profile page shows a `⚙ KeeperHub ↗` badge.

---

## Contracts

| Contract | Chain | Purpose |
|---|---|---|
| `ComposiaRegistry.sol` | LUKSO Testnet | Maps `agentEOA → upAddress + kmAddress`; stores reputation snapshots; emits `ReputationUpdated` |
| `MockGensyn.sol` | LUKSO Testnet | Emits `VerificationCompleted` events for development and testing |
| `SyncerContract.sol` | Ethereum Sepolia | Receives cross-chain reputation updates from the oracle |
| `ComposiaSubdomainRegistrar.sol` | Ethereum Sepolia | Wraps the ENS NameWrapper parent; used only for on-chain custom-name registration — auto names are created gaslessly via Namespace SDK |
| `ReputationState.sol` | Ethereum Sepolia | Reactive live state: verification status, slashing, quorum, bidirectional identity resolution |
| `ENSNameManager.sol` | Ethereum Sepolia | Two-tier ENS name system; agents register custom names from their wallet |
| `ERC8004IdentityRegistry.sol` | Ethereum Sepolia | ERC-8004 Identity Registry — agents self-mint an ERC-721 identity token pointing to their `agentURI` |

---

## Repository structure

```
/
├── keeperhub-workflows/         KeeperHub workflow definitions (import into your fork)
│   ├── step1-create-up.ts       Action: POST /api/keeper — deploy UP + KM for new agents
│   ├── step2-register-ens.ts    Action: POST /api/keeper/register-ens — create ENS subdomain
│   ├── step3-update-reputation.ts Action: POST /api/keeper/update-reputation — sync Gensyn data
│   └── index.ts                 Re-exports all workflows
│
├── packages/
│   ├── contracts/               Solidity contracts + Hardhat
│   │   ├── contracts/
│   │   │   ├── ComposiaRegistry.sol
│   │   │   ├── ComposiaSubdomainRegistrar.sol
│   │   │   ├── ENSNameManager.sol
│   │   │   ├── ERC8004IdentityRegistry.sol
│   │   │   ├── MockGensyn.sol
│   │   │   └── ReputationState.sol
│   │   └── scripts/
│   │       ├── deploy-lukso.ts      Deploy ComposiaRegistry + MockGensyn
│   │       ├── deploy-ens.ts        Deploy ENS stack to Sepolia (4 contracts)
│   │       ├── deploy-sepolia.ts    Deploy SyncerContract to Sepolia
│   │       ├── deploy-local.ts      Deploy full stack to local Hardhat node
│   │       ├── wrap-composia-ens.ts Wrap composia.eth into ENS NameWrapper
│   │       └── simulate.ts          Emit a test VerificationCompleted event
│   │
│   ├── listener/                Always-on oracle process
│   │   └── src/
│   │       ├── index.ts              Entry point; wires listener + queue + processor
│   │       ├── gensyn-listener.ts    Subscribes to VerificationCompleted on LUKSO
│   │       ├── queue.ts              In-memory FIFO queue; deduplicates jobs by agent
│   │       ├── processor.ts          Drains queue; calls UP manager
│   │       ├── up-manager.ts         Deploys UP + KM; writes LSP3; routes through KM.execute
│   │       ├── ens-registrar.ts      Registers ENS subdomain + seeds ReputationState
│   │       ├── namespace-client.ts   Namespace SDK client for gasless ENS subname creation
│   │       ├── axl-client.ts         Axelar cross-chain messaging client
│   │       ├── axl-service.ts        Axelar service layer for cross-chain sync
│   │       ├── reputation.ts         Encodes LSP3 data keys / values
│   │       └── notify.ts             Optional Discord webhook notifications
│   │
│   └── frontend/                Next.js 14 app (App Router, server components)
│       ├── app/
│       │   ├── page.tsx              Landing page
│       │   ├── grid/                 Agent grid — lists all registered agents
│       │   ├── agent/[address]/      Agent profile (Composia Score + ENS + OwnerPanel)
│       │   ├── claim/[upAddress]/    Claim UP ownership from the browser
│       │   ├── demo/                 Simulate reputation flow without live contracts
│       │   ├── keeper/               Keeper Hub dashboard + Run Now button
│       │   └── api/
│       │       ├── agent/[address]/       Agent profile JSON
│       │       ├── agents/                All agents list from ComposiaRegistry
│       │       ├── ens/check-name/        GET ?name= — checks label availability
│       │       ├── keeper/                KeeperHub webhook (POST) + history (GET)
│       │       ├── keeperhub/auto-config/ Self-describing KeeperHub config (GET)
│       │       ├── reputation/[address]/  GET live ReputationState; POST slash/restore/settle
│       │       ├── simulate/              Manual simulation endpoint
│       │       ├── status/                Health check (KeeperHub condition URL)
│       │       └── sync/                  Cross-chain sync trigger
│       ├── components/
│       │   ├── ComposiaScoreCard.tsx  Arc gauge + 5-component breakdown
│       │   ├── owner/                 OwnerPanel + 5 tabs (Profile/Controllers/Follow/Recovery/ENS Identity)
│       │   └── ...                    ReputationGauge, BadgeList, ChainSyncStatus, GovernancePanel, etc.
│       └── lib/
│           ├── score.ts               Composia Score calculators (5 components)
│           ├── namespace.ts           Namespace SDK client — gasless ENS subname creation + text record updates
│           ├── keeper-log.ts          In-memory keeper execution log (singleton, cap 100)
│           ├── contracts.ts           ethers.js contract helpers
│           ├── mock-data.ts           Deterministic mock data generator (address-seeded, stable)
│           └── types.ts               Shared TypeScript types
```

---

## Quick start

### Prerequisites

- Node.js ≥ 18, pnpm ≥ 9
- Two funded wallets: `DEPLOYER_PRIVATE_KEY` (deployer), `COMPOSIA_PRIVATE_KEY` (oracle listener)
- LUKSO Testnet LYX from the [faucet](https://faucet.testnet.lukso.network/)
- Sepolia ETH from any faucet

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in private keys, RPC URLs, and deployed contract addresses
```

Core variables:

```env
# Wallets
DEPLOYER_PRIVATE_KEY=0x...
COMPOSIA_PRIVATE_KEY=0x...

# RPCs
LUKSO_TESTNET_RPC=https://rpc.testnet.lukso.network
ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com

# Security
COMPOSIA_API_KEY=<openssl rand -hex 32>    # Bearer token for keeper + sync endpoints

# Frontend (public)
NEXT_PUBLIC_LUKSO_RPC=https://rpc.testnet.lukso.network
NEXT_PUBLIC_LSP26_ADDRESS=0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA
```

### 3. Deploy contracts

```bash
# LUKSO Testnet — ComposiaRegistry + MockGensyn
pnpm deploy:lukso

# Ethereum Sepolia — full ENS stack + ReputationState + ENSNameManager
pnpm deploy:sepolia
```

Addresses are written to `.env.deployed` (gitignored). Copy `COMPOSIA_REGISTRY_ADDRESS`, `REPUTATION_STATE_ADDRESS`, and ENS contract addresses into `packages/frontend/.env.local`.

### 4. Start the oracle listener

```bash
pnpm listener:dev
```

Subscribes to `VerificationCompleted` on LUKSO Testnet. On each event: deploys UP + KM, writes LSP3 metadata, registers ENS subdomain, seeds ReputationState on Sepolia.

### 5. Start the frontend

```bash
pnpm frontend:dev
# → http://localhost:3000
```

### 6. Simulate an agent event

```bash
# Emit VerificationCompleted from MockGensyn
pnpm --filter @composia/contracts exec hardhat run scripts/simulate.ts --network lukso-testnet

# Or via API (requires COMPOSIA_API_KEY):
curl -X POST http://localhost:3000/api/simulate \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"agent":"0x...", "accuracy":85, "verifications":1200}'
```

---

## Agent profile page

`/agent/{agentEOA}` shows:

- **Composia Score card** — arc gauge, tier badge (Elite / Trustworthy / Developing / New), and 5-component breakdown bars with weights
- **Reputation gauge** — raw Gensyn accuracy %, trend, streak
- **Specialization radar** — code / math / logic domain breakdown
- **Reliability scorecard** — uptime, streak, velocity
- **Activity timeline** — monthly problem count + accuracy trend
- **Collaboration network** — frequent partners graph
- **Composia Identity Powers** — 4 styled cards (matching the landing page design language) explaining what verified reputation enables: Governance voting, DeFi Hooks (`isCurrentlyVerified`), Cross-chain identity, Marketplace access
- **ENS Identity panel** — live data from ReputationState.sol:
  - Verified / Slashed / Below threshold badge
  - All registered subdomains with primary badge
  - Text records stored under the ENS name (`gensyn:accuracy`, `gensyn:verifications`, `gensyn:up_address`, `url`, `erc8004:agentURI`)
  - NameWrapper fuses (CANNOT_UNWRAP, CANNOT_SET_RESOLVER) with expiry
  - Quorum display and slash expiry countdown
  - DeFi composability callout (`isCurrentlyVerified`, `getQuorum`)
- **Universal Profile panel** — UP / KM addresses, LSP3 keys, link to universalprofile.cloud
- **Cross-chain sync status** — LUKSO + Sepolia sync indicator
- **Owner panel** (wallet-gated, LSP6-enforced) — 5 tabs:
  - **Edit Profile** — reads/writes LSP3 JSON directly from UP via KM.execute
  - **Controllers** — add/remove addresses with preset permission bundles
  - **Follow Agents** — LSP26 follow/unfollow other Composia agents
  - **Social Recovery** — LSP11 guardian setup
  - **ENS Identity** — shows stored text records, explains what the ENS node enables, lets the agent register a custom subdomain alias

---

## ENS name system

| Tier | Example | Created by | When |
|---|---|---|---|
| Auto | `a1b2c3d4.composia.eth` | Composia oracle | At UP creation |
| Custom | `alice.composia.eth` | Agent (from EOA) | Anytime after registration |

Availability check:
```
GET /api/ens/check-name?name=alice
→ { available: true, ensName: "alice.composia.eth" }
```

---

## Keeper API

```bash
# Trigger keeper run (KeeperHub webhook)
POST /api/keeper
Authorization: Bearer <COMPOSIA_API_KEY>
{ "action": "run" }           # creates UPs for eligible new agents
{ "action": "scan" }          # list events without creating UPs

# Execution history (public, no auth)
GET /api/keeper/history

# KeeperHub auto-config (public)
GET /api/keeperhub/auto-config
```

```bash
# Live ERC-8004 agent registration file (public, no auth)
GET /api/agent/{agentEOA}/erc8004
# Returns ERC-8004 §registration-v1 JSON with live reputation data.
# Cached for 60 seconds. Populates registrations[] once agent has self-registered.
```

---

## Reputation API

```bash
# Live state from ReputationState.sol
GET /api/reputation/{agentEOA}

# Governance actions (require Bearer token)
POST /api/reputation/{agentEOA}
{ "action": "slash", "durationSeconds": 86400, "reason": "Sybil suspected" }
{ "action": "restore" }
{ "action": "settle" }        # settle an expired slash (permissionless)
```

Response includes `reputation`, `reputationPct`, `verified`, `slashed`, `slashExpiresAt`, `followerCount`, `quorum`, `threshold`, `meetsThreshold`, `agentLabels`, `ensName`.

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Smart contracts | Solidity + Hardhat | 0.8.24 / 2.22 |
| OpenZeppelin | ERC725Y, AccessControl, IERC1155, ERC721URIStorage | 5.x |
| LUKSO identity | LSP0 UniversalProfile, LSP6 KeyManager, LSP3 Metadata, LSP26 Followers | `@lukso/lsp-smart-contracts` |
| ENS | NameWrapper, PublicResolver (canonical Sepolia), NameHash | ENS v2 |
| Namespace SDK | Offchain ENS subname manager — gasless auto-registration | [namespace.ninja](https://namespace.ninja) |
| ERC-8004 | Trustless Agents (draft) — identity, ENS text records, registration file | [eip-8004](https://eips.ethereum.org/EIPS/eip-8004) |
| Oracle / listener | Node.js, ethers.js | 18 / 6.13 |
| Frontend | Next.js App Router, React, Tailwind CSS, Recharts | 14.2 / 18.3 / 3.4 |
| Wallet | ethers.js BrowserProvider (no Wagmi) | 6.13 |
| Automation | KeeperHub workflows | — |
| Monorepo | pnpm workspaces | 9.15 |
| Language | TypeScript | 5.4 |

---

## License

Licensed under the **Apache License, Version 2.0** — see [LICENSE](LICENSE) for the full text.

Apache 2.0 was chosen over MIT because it includes an explicit **patent grant**: any contributor who holds a patent covering their contribution cannot later assert that patent against users of this software. This protection matters for infrastructure used in economic systems (AI agent reputation, DeFi composability, governance voting power). The license is fully open: fork it, deploy it, build on it.

```
Copyright 2026 Composia Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```


