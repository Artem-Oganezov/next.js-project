import { getEnv } from "@/lib/env";

/** When true, POST /api/game/score returns 202 and a worker processes replay. */
export function isScoreAsyncEnabled(): boolean {
  return getEnv().SCORE_ASYNC;
}

/** Stuck `processing` jobs are failed and session locks released after this window. */
export const SCORE_JOB_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

const MIN_WORKER_CONCURRENCY = 1;
const MAX_WORKER_CONCURRENCY = 16;

/** Parallel BRPOP consumers per worker process (env `SCORE_WORKER_CONCURRENCY`, default 1). */
export function getScoreWorkerConcurrency(): number {
  const raw = Number(process.env.SCORE_WORKER_CONCURRENCY ?? "1");
  if (!Number.isFinite(raw)) {
    return MIN_WORKER_CONCURRENCY;
  }
  return Math.min(
    MAX_WORKER_CONCURRENCY,
    Math.max(MIN_WORKER_CONCURRENCY, Math.floor(raw)),
  );
}
