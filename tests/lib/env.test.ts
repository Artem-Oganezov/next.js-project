import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";

describe("getEnv", () => {
  afterEach(() => {
    process.env.SCORE_ASYNC = "false";
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetEnvCache();
  });

  it("returns validated environment", () => {
    const env = getEnv();
    expect(env.MONGODB_URI).toBeTruthy();
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects SCORE_ASYNC without TCP REDIS_URL", () => {
    process.env.SCORE_ASYNC = "true";
    delete process.env.REDIS_URL;
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    resetEnvCache();

    expect(() => getEnv()).toThrow(/SCORE_ASYNC requires REDIS_URL/);
  });
});
