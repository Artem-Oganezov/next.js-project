import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";

describe("getEnv", () => {
  afterEach(() => {
    resetEnvCache();
  });

  it("returns validated environment", () => {
    const env = getEnv();
    expect(env.MONGODB_URI).toBeTruthy();
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
