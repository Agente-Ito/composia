import { notify } from "./notify";

export interface Job {
  agent: string;
  accuracy: number;
  verifications: number;
  attempts: number;
  firstSeen: number;
  peerId?: string;
}

type JobHandler = (job: Job) => Promise<void>;

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;

const queue: Job[] = [];
const dlq: Job[] = [];
let running = false;

export function enqueue(agent: string, accuracy: number, verifications: number): void {
  // Deduplicate: if a job for this agent is already queued, update it instead of adding
  const existing = queue.find((j) => j.agent.toLowerCase() === agent.toLowerCase());
  if (existing) {
    existing.accuracy = accuracy;
    existing.verifications = verifications;
    return;
  }
  queue.push({ agent, accuracy, verifications, attempts: 0, firstSeen: Date.now() });
}

export function getDLQ(): Job[] {
  return [...dlq];
}

export async function startProcessing(handler: JobHandler): Promise<void> {
  if (running) return;
  running = true;
  console.log("[queue] Worker started");

  while (running) {
    const job = queue.shift();
    if (!job) {
      await sleep(500);
      continue;
    }
    await processWithRetry(job, handler);
  }
}

export function stopProcessing(): void {
  running = false;
}

async function processWithRetry(job: Job, handler: JobHandler): Promise<void> {
  while (job.attempts < MAX_ATTEMPTS) {
    try {
      await handler(job);
      console.log(`[queue] ✓ Processed agent ${job.agent} (attempt ${job.attempts + 1})`);
      return;
    } catch (err: unknown) {
      job.attempts++;
      const delay = Math.min(1000 * 2 ** (job.attempts - 1), MAX_BACKOFF_MS);
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[queue] ✗ Attempt ${job.attempts}/${MAX_ATTEMPTS} failed for ${job.agent}: ${msg}`);

      if (job.attempts < MAX_ATTEMPTS) {
        console.log(`[queue]   Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // Exhausted retries → move to DLQ
  dlq.push(job);
  const alertMsg = `[COMPOSIA] Job failed after ${MAX_ATTEMPTS} attempts for agent ${job.agent}`;
  console.error(`[queue] Dead-letter: ${alertMsg}`);
  await notify(alertMsg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
