import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { resetRedisCache } from "@/lib/redis";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  })),
}));

export function clearTestCookies(): void {
  cookieJar.clear();
}

process.env.AUTH_SECRET = "vitest-auth-secret-at-least-32-chars";
// Integration tests expect synchronous score processing (200 + rank in response).
process.env.SCORE_ASYNC = "false";
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
// Intentionally unavailable Redis: code must work via Mongo fallback
// (rate limit — fail-open, rank — direct count in Mongo).
process.env.REDIS_URL = "redis://127.0.0.1:6399";

resetEnvCache();
resetRedisCache();

const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

afterEach(async () => {
  clearTestCookies();
  resetEnvCache();
  resetRedisCache();

  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }

  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoServer.stop();
});
