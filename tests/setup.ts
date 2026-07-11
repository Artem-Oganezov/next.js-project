import { afterAll, afterEach, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { resetRedisCache } from "@/lib/redis";
import {
  applyBaseTestEnv,
  clearTestCookies,
  resetMongooseBetweenTests,
  resolveMongoForTests,
  teardownMongoose,
  testCookieHandlers,
  UNAVAILABLE_REDIS_URL,
  type MongoTestBackend,
} from "./helpers/test-infra";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => testCookieHandlers),
}));

applyBaseTestEnv();
// Intentionally unavailable Redis: code must work via Mongo fallback.
process.env.REDIS_URL = UNAVAILABLE_REDIS_URL;
resetEnvCache();
await resetRedisCache();

const mongoBackend: MongoTestBackend = await resolveMongoForTests();
process.env.MONGODB_URI = mongoBackend.uri;
resetEnvCache();

afterEach(async () => {
  clearTestCookies();
  resetEnvCache();
  await resetRedisCache();
  await resetMongooseBetweenTests();
  process.env.MONGODB_URI = mongoBackend.uri;
  resetEnvCache();
});

afterAll(async () => {
  await teardownMongoose();
  await mongoBackend.stop();
});

export { clearTestCookies };
