/**
 * KeeperHub Workflows — Composia Attestor
 *
 * 3-step event-driven pipeline:
 *   Step 1: MockGensyn.VerificationCompleted  → create-up        (LUKSO → LUKSO)
 *   Step 2: ComposiaRegistry.ProfileRegistered → register-ens    (LUKSO → Sepolia)
 *   Step 3: ComposiaRegistry.ReputationUpdated → update-reputation (LUKSO → Sepolia)
 *
 * Full auto-config JSON: GET https://composia-frontend.vercel.app/api/keeperhub/auto-config
 */
export { workflow as step1CreateUp }          from "./step1-create-up";
export { workflow as step2RegisterEns }       from "./step2-register-ens";
export { workflow as step3UpdateReputation }  from "./step3-update-reputation";
