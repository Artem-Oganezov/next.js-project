import { getEnv } from "@/lib/env";

/** When true, POST /api/game/score returns 202 and a worker processes replay. */
export function isScoreAsyncEnabled(): boolean {
  return getEnv().SCORE_ASYNC;
}
