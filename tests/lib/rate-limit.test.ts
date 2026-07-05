import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { enforceRateLimit } from "@/lib/security/rate-limit";

// In tests Redis is intentionally unavailable (redis://127.0.0.1:6399) —
// verifies limiter behavior when Redis is down.
describe("enforceRateLimit with unavailable Redis", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_FAIL_CLOSED;
    resetEnvCache();
  });

  it("fail-open by default: request passes", async () => {
    resetEnvCache();
    const result = await enforceRateLimit("test:open", 5, 60_000);
    expect(result.ok).toBe(true);
  });

  it("fail-closed when RATE_LIMIT_FAIL_CLOSED=true: request rejected", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "true";
    resetEnvCache();

    const result = await enforceRateLimit("test:closed", 5, 60_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("explicit RATE_LIMIT_FAIL_CLOSED=false keeps fail-open", async () => {
    process.env.RATE_LIMIT_FAIL_CLOSED = "false";
    resetEnvCache();

    const result = await enforceRateLimit("test:explicit-open", 5, 60_000);
    expect(result.ok).toBe(true);
  });
});
