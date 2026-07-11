import { afterAll, afterEach, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { resetMetrics } from "@/lib/observability/metrics";
import { resetRedisCache } from "@/lib/redis";
import { resetRateLimitState } from "@/lib/security/rate-limit";
import { resetClientIpState } from "@/lib/api/http";
import {
  applyBaseTestEnv,
  clearTestCookies,
  flushRedisDb,
  resetMongooseBetweenTests,
  resolveMongoForTests,
  resolveRedisForTests,
  teardownMongoose,
  testCookieHandlers,
  type MongoTestBackend,
  type RedisTestBackend,
} from "./helpers/test-infra";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => testCookieHandlers),
}));

applyBaseTestEnv();

const redisBackend: RedisTestBackend = await resolveRedisForTests();
process.env.REDIS_URL = redisBackend.url;
process.env.REVIVE_CHALLENGE_MIN_MS = "0";
resetEnvCache();

export function isRedisAvailable(): boolean {
  return redisBackend.available;
}

const mongoBackend: MongoTestBackend = await resolveMongoForTests();
process.env.MONGODB_URI = mongoBackend.uri;
resetEnvCache();

afterEach(async () => {
  clearTestCookies();
  resetEnvCache();
  await resetRedisCache();
  resetRateLimitState();
  resetClientIpState();
  resetMetrics();

  await resetMongooseBetweenTests();
  process.env.MONGODB_URI = mongoBackend.uri;
  process.env.REDIS_URL = redisBackend.url;
  process.env.REVIVE_CHALLENGE_MIN_MS = "0";
  resetEnvCache();

  if (redisBackend.available) {
    await flushRedisDb(redisBackend.url);
  }
});

afterAll(async () => {
  await teardownMongoose();
  await mongoBackend.stop();
});

export { clearTestCookies };
