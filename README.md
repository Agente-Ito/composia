# Composia

**Composia** turns Gensyn compute-agent reputation into portable, cross-chain identity.

When a Gensyn node completes a verification round, Composia automatically creates a [Lukso Universal Profile](https://universalprofile.cloud/) for the agent and anchors their reputation to an ENS subdomain on Ethereum Sepolia — all without the agent doing anything. The agent can then claim ownership of their profile and set a custom ENS name.

---

## What it does

```
Gensyn chain
  └─ VerificationCompleted(agent, accuracy, verifications)
        │
        ▼
  GensynListener (Lukso Testnet)
        ├─ Deploy LSP0 UniversalProfile
        ├─ Deploy LSP6 KeyManager
        ├─ Write LSP3 reputation metadata
        ├─ Register in AttestorRegistry
        │
        └─ (Ethereum Sepolia, non-blocking)
              ├─ AttestorSubdomainRegistrar → {hex8}.composia.eth
              │     └─ PublicResolver text records: gensyn:accuracy, verifications, up_address …
              └─ ReputationState
                    ├─ registerAgent(eoa, upAddress, ensNode, label)
                    ├─ updateVerificationStatus(node, repBps, verified)
                    └─ syncFollowerCount(node, followers)
```

### Layer 1 — Lukso Universal Profile

Each agent gets a Lukso UP deployed by the Composia oracle wallet. The UP stores LSP3 metadata keys like `gensyn:reputation`, `gensyn:verifications`, and `gensyn:peerId`. The agent is set as `pendingOwner` immediately after creation, so they can claim full control by calling `UP.acceptOwnership()` from their EOA — no trust required after that.

### Layer 2 — ENS subdomain on Ethereum Sepolia

Simultaneously, the oracle registers `{first8hexOfEOA}.composia.eth` via the **AttestorSubdomainRegistrar** contract. Text records mirror the Gensyn stats; `addr(60)` resolves to the agent's EOA.

### Layer 3 — ReputationState (reactive governance)

**ReputationState.sol** is the single source of truth for live agent state. Unlike the ENS text records (which are historical snapshots), `ReputationState` is mutable:

| Function | Who calls it | Purpose |
|---|---|---|
| `updateVerificationStatus(node, repBps, verified)` | oracle (listener) | Updates reputation in basis points; derives verified flag |
| `syncFollowerCount(node, count)` | oracle | Mirrors LSP26 follower count from Lukso |
| `slashAgent(node, duration, reason)` | owner (governance) | Temporary penalty, auto-expires |
| `restoreAgent(node)` | owner | Early restore after appeal |
| `settleSlash(node)` | anyone | Settle an expired slash without waiting for a read |

Primary **DeFi composability hooks** (designed for Aave LTV, DAO voting, marketplace access):

```solidity
isCurrentlyVerified(bytes32 node) → bool
getQuorum(bytes32 node)           → uint256   // 50%+1 of followers
getCurrentStatus(bytes32 node)    → (rep, verified, slashed, slashExpiresAt, followers, lastUpdated)
resolveAgent(bytes32 node)        → (agentEoa, upAddress)
```

Reputation is stored in **basis points** (accuracy% × 100). Default verification threshold is **6000 bps (60%)**.

### Custom ENS names (agent-driven)

Agents can register a second, human-readable name like `alice.composia.eth` by calling `ENSNameManager.setCustomName("alice")` from their EOA on Sepolia. The contract verifies they are a registered agent via `ReputationState`, creates the subdomain (Composia sponsors ENS gas via the Registrar), and sets the custom name as their primary. The auto-generated `{hex8}` name remains active.

---

## Contracts

| Contract | Chain | Role |
|---|---|---|
| `AttestorRegistry` | Lukso Testnet | Maps agent EOA → UP address + KM address; stores reputation snapshots |
| `MockGensyn` | Lukso Testnet | Emits `VerificationCompleted` events for testing |
| `AttestorSubdomainRegistrar` | Ethereum Sepolia | Creates `*.composia.eth` subdomains via ENS NameWrapper; writes text records |
| `ReputationState` | Ethereum Sepolia | Reactive live state: verification, slashing, quorum, bidirectional identity |
| `ENSNameManager` | Ethereum Sepolia | 2-tier ENS name system; agents register custom names from their wallet |

---

## Repository structure

```
/
├── packages/
│   ├── contracts/           Solidity contracts + Hardhat deploy scripts
│   │   ├── contracts/
│   │   │   ├── AttestorRegistry.sol
│   │   │   ├── AttestorSubdomainRegistrar.sol
│   │   │   ├── ENSNameManager.sol
│   │   │   ├── MockGensyn.sol
│   │   │   └── ReputationState.sol
│   │   └── scripts/
│   │       ├── deploy-lukso.ts   Deploy AttestorRegistry + MockGensyn to Lukso Testnet
│   │       ├── deploy-ens.ts     Deploy ENS stack to Ethereum Sepolia (4 contracts)
│   │       ├── deploy-sepolia.ts Deploy SyncerContract to Sepolia
│   │       └── simulate.ts       Emit a test VerificationCompleted event
│   │
│   ├── listener/            Node.js oracle process
│   │   └── src/
│   │       ├── index.ts          Entry point; wires listener + queue + processor
│   │       ├── gensyn-listener.ts Subscribes to VerificationCompleted on Lukso
│   │       ├── queue.ts          In-memory FIFO queue; deduplicates jobs by agent
│   │       ├── processor.ts      Drains queue; calls UPManager.createAndRegister or .update
│   │       ├── up-manager.ts     Deploys UP + KM; writes LSP3; routes through KM.execute
│   │       ├── ens-registrar.ts  Registers ENS subdomain + seeds ReputationState (Sepolia)
│   │       ├── reputation.ts     Encodes LSP3 data keys and values
│   │       └── notify.ts         Optional Discord webhook notifications
│   │
│   └── frontend/            Next.js 14 app (App Router, server components)
│       └── app/
│           ├── page.tsx          Landing page
│           ├── grid/             Agent grid — lists all registered agents
│           ├── agent/[address]/  Agent profile page (reputation + ENS + OwnerPanel)
│           ├── claim/[upAddress] Claims UP ownership from the browser
│           ├── demo/             Simulate reputation flow without live contracts
│           └── api/
│               ├── agent/[address]    Agent profile JSON (LSP3 + ENS text records)
│               ├── agents/            All agents list from AttestorRegistry
│               ├── ens/check-name     GET ?name=xxx — checks ENSNameManager.isLabelAvailable
│               ├── gensyn/            Proxy to Gensyn chain for live node stats
│               ├── keeper/            KeeperHub webhook — triggers UP creation on demand
│               ├── reputation/[address] GET live ReputationState; POST slash/restore/settle
│               ├── seed/              Seeds mock Gensyn events for testing
│               ├── simulate/          Manual simulation endpoint
│               ├── status/            Health check
│               └── sync/              Cross-chain sync trigger
```

---

## Quick start

### Prerequisites

- Node.js ≥ 18, pnpm ≥ 8
- Two wallets with testnet funds: `DEPLOYER_PRIVATE_KEY` (deployer/oracle), `ATTESTOR_PRIVATE_KEY` (listener oracle)
- Lukso Testnet LYX from the [faucet](https://faucet.testnet.lukso.network/)
- Sepolia ETH from any Sepolia faucet

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your private keys and RPC URLs
```

Key variables:

```env
DEPLOYER_PRIVATE_KEY=0x...
ATTESTOR_PRIVATE_KEY=0x...
LUKSO_TESTNET_RPC=https://rpc.testnet.lukso.network
ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com   # free, no API key
ATTESTOR_API_KEY=<openssl rand -hex 32>                            # Bearer token for keeper
```

### 3. Deploy contracts

```bash
# Lukso Testnet — AttestorRegistry + MockGensyn
pnpm deploy:lukso

# Ethereum Sepolia — AttestorSubdomainRegistrar + ReputationState + ENSNameManager
pnpm deploy:sepolia
```

Contract addresses are written automatically to `.env.deployed` (gitignored). The listener and frontend load both files at startup.

Copy the `REPUTATION_STATE_ADDRESS`, `ENS_REGISTRAR_ADDRESS`, and `ENS_NAME_MANAGER_ADDRESS` values into `packages/frontend/.env.local`.

### 4. Start the listener

```bash
pnpm listener:dev
```

The listener connects to Lukso Testnet and subscribes to `VerificationCompleted` events. When one arrives it creates a UP + KM, writes reputation data, and registers the ENS subdomain on Sepolia — all in a single pipeline.

### 5. Start the frontend

```bash
pnpm frontend:dev
# → http://localhost:3000
```

### 6. Simulate an agent event (for testing)

```bash
# Emit a VerificationCompleted event from MockGensyn
pnpm --filter @attestor/contracts exec hardhat run scripts/simulate.ts --network lukso-testnet

# Or via the API (requires ATTESTOR_API_KEY):
curl -X POST http://localhost:3000/api/simulate \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"agent":"0x...", "accuracy":85, "verifications":1200}'
```

---

## Agent profile page

`/agent/{agentEOA}` shows:

- **Reputation gauge** — accuracy %, problems solved, earnings estimate
- **Specialization radar** — code / math / logic domain breakdown
- **Reliability scorecard** — uptime, streak, velocity
- **Activity timeline** — daily problem count + accuracy trend (Recharts)
- **Collaboration network** — frequent partners graph
- **ENS Identity panel** — live reactive state from `ReputationState.sol`:
  - Live badge: Verified / Slashed / Below threshold / Pending
  - Reputation bar with 60% threshold marker
  - Quorum display (`getQuorum`)
  - Slash expiry countdown
  - DeFi composability callout (`isCurrentlyVerified`, `getQuorum`)
  - Layer 1 text record snapshot
- **Universal Profile** — UP address, KM address, LSP3 keys, link to universalprofile.cloud
- **Cross-chain sync** — Lukso + Sepolia sync status
- **Owner panel** (wallet-gated) — Edit Profile, Controllers, Follow Agents, Social Recovery, **ENS Name** (set custom `*.composia.eth` directly from browser wallet)

---

## ENS name system

| Tier | Name | Created by | When |
|---|---|---|---|
| 1 — Auto | `{hex8}.composia.eth` | Composia oracle | Automatically at UP creation |
| 2 — Custom | `{yourchoice}.composia.eth` | Agent (from their EOA) | Anytime after registration |

Both names resolve to the same agent profile. The custom name becomes the primary displayed name. Label rules: 3–32 chars, lowercase alphanumeric + dash, no leading/trailing dash.

Availability check: `GET /api/ens/check-name?name=alice` → `{ available: true, ensName: "alice.composia.eth" }`

---

## Reputation API

```bash
# Live state from ReputationState.sol
GET /api/reputation/{agentEOA}

# Slash / restore / settle (requires Bearer token)
POST /api/reputation/{agentEOA}
Content-Type: application/json
Authorization: Bearer <ATTESTOR_API_KEY>

{ "action": "slash", "durationSeconds": 86400, "reason": "Sybil suspected" }
{ "action": "restore" }
{ "action": "settle" }
```

Response includes `reputation`, `reputationPct`, `verified`, `slashed`, `slashExpiresAt`, `followerCount`, `quorum`, `threshold`, `meetsThreshold`, `agentLabels`, `ensName`.

---

## KeeperHub integration

`POST /api/keeper` (Bearer token required) accepts a `VerificationCompleted`-shaped payload and triggers the same pipeline as a live Gensyn event — useful for automating periodic reputation refreshes without a running listener.

---

## Tech stack

| Layer | Tech |
|---|---|
| Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin |
| Lukso identity | LSP0 UniversalProfile, LSP6 KeyManager, LSP3 Metadata, LSP26 Followers |
| ENS | NameWrapper, PublicResolver (Sepolia canonical addresses) |
| Oracle / listener | Node.js, ethers.js v6, @erc725/erc725.js |
| Frontend | Next.js 14 (App Router), Tailwind CSS, Recharts |
| Monorepo | pnpm workspaces |
