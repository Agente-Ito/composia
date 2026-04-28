import { Job } from "./queue";
import { UPManager } from "./up-manager";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Core job handler: decides whether to create or update a Universal Profile.
 * This function is passed to startProcessing() as the queue handler.
 *
 * @param onUpdate Optional callback invoked with the agent EOA after every
 *   successful create or update. Used by AxlService to push reputation changes
 *   to all connected AXL peers in real time.
 */
export function makeProcessor(
  upManager: UPManager,
  onUpdate?: (agentEoa: string) => void
) {
  return async function process(job: Job): Promise<void> {
    const existingUP = await upManager.getUP(job.agent);

    if (!existingUP || existingUP === ZERO_ADDRESS) {
      try {
        await upManager.createAndRegister(job);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("UP already registered")) {
          // A parallel retry already completed — treat as update
          const up = await upManager.getUP(job.agent);
          if (up && up !== ZERO_ADDRESS) {
            await upManager.update(job, up);
            onUpdate?.(job.agent);
            return;
          }
        }
        throw err;
      }
    } else {
      await upManager.update(job, existingUP);
    }

    onUpdate?.(job.agent);
  };
}
