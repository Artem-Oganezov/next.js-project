import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";

describe("getEnv", () => {
  afterEach(() => {
    process.env.SCORE_ASYNC = "false";
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    resetEnvCache();
  });

  it("returns validated environment", () => {
    const env = getEnv();
    expect(env.MONGODB_URI).toBeTruthy();
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.REDIS_URL).toMatch(/^rediss?:\/\//);
  });

  it("rejects missing REDIS_URL", () => {
    delete process.env.REDIS_URL;
    resetEnvCache();

    expect(() => getEnv()).toThrow(/REDIS_URL|expected string/);
  });
});
