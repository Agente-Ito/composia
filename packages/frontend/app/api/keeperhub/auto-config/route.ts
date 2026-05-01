import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/keeperhub/auto-config
 * Returns the KeeperHub workflow configuration for the Composia 3-step pipeline.
 * Public endpoint — no secrets exposed.
 *
 * Workflow chain (event-driven):
 *   MockGensyn.VerificationCompleted → Step 1: create-up (LUKSO)
 *   ComposiaRegistry.ProfileRegistered → Step 2: register-ens (Sepolia)
 *   ComposiaRegistry.ReputationUpdated → Step 3: update-reputation (Sepolia)
 */
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const config = {
    name:    "Composia — KeeperHub Integration",
    version: "2.0.0",

    chains: [
      {
        id:       "lukso-testnet",
        chainId:  4201,
        name:     "LUKSO Testnet",
        rpc:      "https://rpc.testnet.lukso.network",
        explorer: "https://explorer.execution.testnet.lukso.network",
      },
      {
        id:       "ethereum-sepolia",
        chainId:  11155111,
        name:     "Ethereum Sepolia",
        rpc:      "https://rpc.sepolia.org",
        explorer: "https://sepolia.etherscan.io",
      },
    ],

    contracts: {
      "lukso-testnet": {
        composiaRegistry: process.env.COMPOSIA_REGISTRY_ADDRESS ?? "",
        mockGensyn:       process.env.MOCK_GENSYN_ADDRESS ?? "",
      },
      "ethereum-sepolia": {
        syncerContract:  process.env.SYNCER_ETHEREUM_ADDRESS ?? "",
        reputationState: process.env.REPUTATION_STATE_ADDRESS ?? "",
      },
    },

    endpoints: {
      // Legacy / manual sweep
      runUrl:               `${base}/api/keeper`,
      // Atomic step endpoints (used by KeeperHub workflows below)
      createUpUrl:          `${base}/api/keeper/create-up`,
      registerEnsUrl:       `${base}/api/keeper/register-ens`,
      updateReputationUrl:  `${base}/api/keeper/update-reputation`,
      // Utility
      simulateUrl:          `${base}/api/keeper/simulate`,
      conditionUrl:         `${base}/api/status`,
      historyUrl:           `${base}/api/keeper/history`,
      autoConfigUrl:        `${base}/api/keeperhub/auto-config`,
    },

    auth: {
      header: "Authorization",
      format: "Bearer <COMPOSIA_API_KEY>",
      envVar: "COMPOSIA_API_KEY",
      note:   "Set COMPOSIA_API_KEY in your KeeperHub environment variables.",
    },

    /**
     * 3-step event-driven pipeline.
     *
     * Step 1 fires on VerificationCompleted → creates the UP on LUKSO.
     *   ComposiaRegistry.updateReputation() emits ReputationUpdated.
     *   ComposiaRegistry.registerUP() emits ProfileRegistered.
     *
     * Step 2 fires on ProfileRegistered → registers ENS subdomain + seeds ReputationState.
     *
     * Step 3 fires on ReputationUpdated → updates reputation scores + syncs to SyncerContract.
     *
     * KeeperHub template variables: {{event.<fieldName>}} resolved from the emitted event args.
     */
    workflows: [
      {
        id:   "step-1-create-up",
        name: "Step 1 — Create Universal Profile",
        step: 1,
        description: "Deploy UP + LSP6 KeyManager on LUKSO and register in ComposiaRegistry.",
        trigger: {
          contract: "MockGensyn",
          event:    "VerificationCompleted",
          chain:    "lukso-testnet",
          // event signature: VerificationCompleted(address indexed agent, uint256 accuracy, uint256 verifications)
        },
        condition: {
          url:      `${base}/api/status`,
          method:   "GET",
          passWhen: "ok === true",
        },
        action: {
          url:        `${base}/api/keeper/create-up`,
          method:     "POST",
          body:       {
            agent:         "{{event.agent}}",
            accuracy:      "{{event.accuracy}}",
            verifications: "{{event.verifications}}",
          },
          authHeader: true,
        },
        outputChain: "lukso-testnet",
        emitsEvents: ["ComposiaRegistry.ProfileRegistered", "ComposiaRegistry.ReputationUpdated"],
      },
      {
        id:   "step-2-register-ens",
        name: "Step 2 — Register ENS Subdomain",
        step: 2,
        description: "Create {hex8}.composia.eth subdomain on Sepolia and seed ReputationState.",
        trigger: {
          contract: "ComposiaRegistry",
          event:    "ProfileRegistered",
          chain:    "lukso-testnet",
          // event signature: ProfileRegistered(address indexed agent, address indexed upAddress)
        },
        action: {
          url:        `${base}/api/keeper/register-ens`,
          method:     "POST",
          body:       {
            agent:     "{{event.agent}}",
            upAddress: "{{event.upAddress}}",
          },
          authHeader: true,
        },
        outputChain: "ethereum-sepolia",
        emitsEvents: [],
      },
      {
        id:   "step-3-update-reputation",
        name: "Step 3 — Update Reputation & Sync",
        step: 3,
        description: "Update ReputationState scores on Sepolia and record in SyncerContract.",
        trigger: {
          contract: "ComposiaRegistry",
          event:    "ReputationUpdated",
          chain:    "lukso-testnet",
          // event signature: ReputationUpdated(address indexed agent, uint96 accuracy, uint96 verifications)
        },
        action: {
          url:        `${base}/api/keeper/update-reputation`,
          method:     "POST",
          body:       {
            agent:         "{{event.agent}}",
            accuracy:      "{{event.accuracy}}",
            verifications: "{{event.verifications}}",
          },
          authHeader: true,
        },
        outputChain: "ethereum-sepolia",
        emitsEvents: [],
      },
    ],
  };

  return NextResponse.json(config);
}
