import { getEnv } from "@/lib/env";

/** When true, POST /api/game/score returns 202 and a worker processes replay. */
export function isScoreAsyncEnabled(): boolean {
  return getEnv().SCORE_ASYNC;
}

/** Stuck `processing` jobs are failed and session locks released after this window. */
export const SCORE_JOB_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
