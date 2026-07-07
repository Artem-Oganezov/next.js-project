import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import IORedis from "ioredis";
import { afterAll, afterEach, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { resetMetrics } from "@/lib/observability/metrics";
import { resetRedisCache } from "@/lib/redis";
import { resetRateLimitState } from "@/lib/security/rate-limit";
import { resetClientIpState } from "@/lib/api/http";

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

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

process.env.AUTH_SECRET = "vitest-auth-secret-at-least-32-chars";
process.env.REDIS_URL = redisUrl;
resetEnvCache();

let redisAvailable = false;
{
  const probe = new IORedis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
  try {
    await probe.connect();
    await probe.ping();
    redisAvailable = true;
  } catch {
    redisAvailable = false;
    console.warn(
      "Redis unavailable — *.redis.test.ts will fail. " +
        "Start Redis on 6379 or set REDIS_URL.",
    );
  } finally {
    await probe.quit().catch(() => {});
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

async function flushRedis(): Promise<void> {
  if (!redisAvailable) return;
  const client = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
  try {
    await client.flushdb();
  } finally {
    await client.quit().catch(() => {});
  }
}

afterEach(async () => {
  clearTestCookies();
  resetEnvCache();
  resetRedisCache();
  resetRateLimitState();
  resetClientIpState();
  resetMetrics();

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

  await flushRedis();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoServer.stop();
});
