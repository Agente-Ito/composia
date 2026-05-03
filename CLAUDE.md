# Composia — Claude Code Context

## What is this project

Composia is a composable reputation layer for AI agents, built for ETHGlobal. It connects Gensyn (verified compute), LUKSO Universal Profiles, and Hyperlane (cross-chain sync) into a single verifiable identity system for autonomous agents.

The visual identity is a **day moth (polilla diurna)** — no antennae. Moths = agents in the Composia narrative.

## Monorepo structure

```
composia/
├── packages/
│   ├── frontend/     ← Next.js 14 App Router (Ile's domain)
│   ├── contracts/    ← Hardhat + Solidity (Antonio's domain)
│   └── listener/     ← Node.js event listener / bridge
```

## Package manager

**pnpm** — always use pnpm, never npm or yarn.

```bash
# Install all
pnpm install

# Run frontend dev server
pnpm --filter @composia/frontend dev
# or from packages/frontend:
pnpm dev

# Run all packages in parallel
pnpm dev
```

Windows note: `.npmrc` has `node-linker=hoisted` to avoid EPERM errors — do not remove this.

## Frontend stack

- **Next.js 14** App Router, TypeScript, Tailwind CSS
- **Three.js** via `@react-three/fiber` v8 + `@react-three/drei` v9 — for the moth network animation
- **shadcn/ui** — base UI components (Card, Badge, Progress, Tabs, Button)
- **Recharts** — score and activity charts
- **TanStack Query** — data fetching from API routes
- **lucide-react** — icons
- **clsx + tailwind-merge** — via `lib/cn.ts` for class merging

## Brand / Design system

Colors (use these exact hex values):
- Background: `#0A0A0F`
- Surface: `#111121`
- Line: `#1A1C23`
- Text/Note: `#EDEFF6`
- Primary purple: `#7B61FF`
- Secondary purple: `#A78BFA`
- Dim text: `#4A4E62`

Typography: Space Grotesk (headers), Sora (body alt), font-mono for data/scores.

Purple is used **only** for state and activity — not as decoration.

The moth (`NetworkScene.tsx`, `MothLogo.tsx`) must:
- Have perfect bilateral X-axis symmetry
- No antennae
- White/silver nodes, ONE purple center node
- Thin white edges with flow animation

## Key files

| File | Purpose |
|------|---------|
| `packages/frontend/app/page.tsx` | Landing page / hero |
| `packages/frontend/components/NetworkScene.tsx` | 3D moth node graph (Three.js) |
| `packages/frontend/components/MothLogo.tsx` | SVG moth logo variants |
| `packages/frontend/lib/types.ts` | All shared TypeScript interfaces |
| `packages/frontend/lib/score.ts` | ComposiaScore calculation logic |
| `packages/frontend/lib/tokens.ts` | Design tokens |
| `packages/frontend/app/grid/page.tsx` | Agent score grid |
| `packages/frontend/app/demo/page.tsx` | Agent event simulation |
| `packages/frontend/app/agent/[address]/page.tsx` | Agent profile page |
| `packages/contracts/contracts/ComposiaRegistry.sol` | Main on-chain reputation contract |

## API routes (frontend/app/api/)

- `GET /api/agents` — list all agents
- `GET /api/agent/[address]` — agent profile + reputation
- `GET /api/reputation/[address]` — raw on-chain reputation data
- `POST /api/simulate` — simulate an agent event (demo)
- `POST /api/sync` — trigger cross-chain sync via Hyperlane
- `GET /api/gensyn` — Gensyn leaderboard data
- `GET /api/keeper/*` — KeeperHub workflow actions

## Chains

- LUKSO Testnet — Universal Profiles + identity
- Sepolia — reputation registry
- Hyperlane — cross-chain message passing

## Conventions

- Components: PascalCase, in `components/`
- API routes: kebab-case directories under `app/api/`
- Use `cn()` from `lib/cn.ts` for all Tailwind class merging
- All Three.js components must use `"use client"` and be dynamically imported with `ssr: false`
- No comments explaining what code does — only comment non-obvious WHY
- No mock data in production paths — mock data lives in `lib/mock-data.ts`

## Cross-platform (Ile = Windows, Antonio = Mac)

- Line endings normalized via `.gitattributes` (LF everywhere)
- Node version pinned in `.nvmrc` (Node 24)
- pnpm works on both — Mac doesn't need special `.npmrc` settings
