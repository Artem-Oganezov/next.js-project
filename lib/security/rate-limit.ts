import { incrementCounter } from "@/lib/observability/metrics";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

const FAIL_CLOSED_RETRY_AFTER_SEC = 30;

let redisFailureLogged = false;

/** Reset logging flag (tests). */
export function resetRateLimitState(): void {
  redisFailureLogged = false;
}

/**
 * Window via Redis INCR + EXPIRE (atomic via Lua).
 *
 * Default fail-open: if Redis is unavailable, the request is allowed —
 * the limiter must not break the API. Redis unavailability is visible via
 * GET /api/health. For strict mode (429 when Redis is down) set
 * RATE_LIMIT_FAIL_CLOSED=true.
 */
export async function enforceRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;

  try {
    const redis = getRedis();
    const windowSec = Math.ceil(windowMs / 1000);
    const hits = await redis.incrWithExpire(redisKey, windowSec);

    if (hits > maxRequests) {
      let ttlSec = await redis.ttl(redisKey);
      if (ttlSec < 0) {
        await redis.expire(redisKey, windowSec);
        ttlSec = windowSec;
      }
      incrementCounter("rate_limit_rejected_total", {
        key_prefix: key.split(":")[0] ?? key,
      });
      return { ok: false, retryAfterSec: Math.max(1, ttlSec) };
    }

    return { ok: true };
  } catch (error) {
    const failClosed = getEnv().RATE_LIMIT_FAIL_CLOSED;

    if (!redisFailureLogged) {
      redisFailureLogged = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          scope: "rate-limit",
          message: `Redis unavailable, rate limiting ${
            failClosed ? "fail-closed (rejecting)" : "disabled"
          }: ${error instanceof Error ? error.message : "unknown"}`,
        }),
      );
    }

    if (failClosed) {
      incrementCounter("rate_limit_rejected_total", { key_prefix: "redis-down" });
      return { ok: false, retryAfterSec: FAIL_CLOSED_RETRY_AFTER_SEC };
    }
    return { ok: true };
  }
}
