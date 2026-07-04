import { describe, expect, it } from "vitest";
import { RATE_LIMIT } from "@/lib/config/app";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isRedisAvailable } from "../redis.setup";

const describeRedis = isRedisAvailable() ? describe : describe.skip;

describeRedis("Redis rate limiting", () => {
  it("rejects requests above the configured limit", async () => {
    const key = `test:rl:${Date.now()}`;
    const { maxRequests, windowMs } = {
      maxRequests: 3,
      windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
    };

    for (let i = 0; i < maxRequests; i++) {
      const result = await enforceRateLimit(key, maxRequests, windowMs);
      expect(result.ok).toBe(true);
    }

    const blocked = await enforceRateLimit(key, maxRequests, windowMs);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
