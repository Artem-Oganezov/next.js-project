import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import IORedis from "ioredis";
import { resetEnvCache } from "@/lib/env";

export const DEFAULT_TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/game-test";
export const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6379";
/** Unreachable Redis — integration tests assert Mongo fallbacks (rate limit fail-open, rank). */
export const UNAVAILABLE_REDIS_URL = "redis://127.0.0.1:6399";

const cookieJar = new Map<string, string>();

/** Shared cookie jar for `vi.mock("next/headers")` in setup files. */
export const testCookieHandlers = {
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
};

export function clearTestCookies(): void {
  cookieJar.clear();
}

/** Canonical test env — overrides anything Vitest or `.env.local` may have loaded. */
export function applyBaseTestEnv(): void {
  process.env.AUTH_SECRET = "vitest-auth-secret-at-least-32-chars";
  process.env.SCORE_ASYNC = "false";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetEnvCache();
}

export type MongoTestBackend = {
  uri: string;
  kind: "external" | "memory";
  stop: () => Promise<void>;
};

async function probeMongo(uri: string, timeoutMs = 3_000): Promise<boolean> {
  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs,
  });

  try {
    await connection.asPromise();
    return true;
  } catch {
    return false;
  } finally {
    await connection.close().catch(() => {});
  }
}

async function probeRedis(url: string, timeoutMs = 3_000): Promise<boolean> {
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: timeoutMs,
    lazyConnect: true,
  });

  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    await client.quit().catch(() => {});
  }
}

/** One database per Vitest fork — shared Docker Mongo must not use a single DB. */
export function withWorkerDatabase(uri: string): string {
  const workerId = process.env.VITEST_WORKER_ID ?? "0";
  const qIndex = uri.indexOf("?");
  const base = qIndex === -1 ? uri : uri.slice(0, qIndex);
  const query = qIndex === -1 ? "" : uri.slice(qIndex);

  const slash = base.lastIndexOf("/");
  if (slash === -1 || slash <= "mongodb://".length) {
    return `${base}/game-test-w${workerId}${query}`;
  }

  const prefix = base.slice(0, slash + 1);
  const dbName = base.slice(slash + 1);
  const rootDb = dbName || "game-test";
  return `${prefix}${rootDb}-w${workerId}${query}`;
}

function mongoCandidates(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of [process.env.TEST_MONGODB_URI, DEFAULT_TEST_MONGODB_URI]) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(withWorkerDatabase(raw));
  }

  return out;
}

function redisCandidates(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const url of [process.env.TEST_REDIS_URL, DEFAULT_TEST_REDIS_URL]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }

  return out;
}

/**
 * Prefer Docker Mongo (local/Windows), fall back to MongoMemoryServer (Linux CI).
 */
export async function resolveMongoForTests(): Promise<MongoTestBackend> {
  for (const uri of mongoCandidates()) {
    if (await probeMongo(uri)) {
      console.info(`[test] Mongo: external (${uri})`);
      return {
        uri,
        kind: "external",
        stop: async () => {},
      };
    }
  }

  if (process.platform === "win32" && process.env.ALLOW_MEMORY_MONGO !== "true") {
    throw new Error(
      [
        "Mongo is unavailable for tests.",
        "",
        "On Windows use Docker (recommended):",
        "  docker compose -f docker-compose.dev.yml up -d",
        "",
        "Then run:",
        "  npm test",
        "",
        "Optional override:",
        "  TEST_MONGODB_URI=mongodb://127.0.0.1:27017/game-test",
        "",
        "Emergency fallback (unreliable on Windows):",
        "  ALLOW_MEMORY_MONGO=true npm test",
      ].join("\n"),
    );
  }

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  console.info(`[test] Mongo: in-memory (${uri})`);
  return {
    uri,
    kind: "memory",
    stop: async () => {
      await mongoServer.stop();
    },
  };
}

export type RedisTestBackend = {
  url: string;
  available: boolean;
};

export async function resolveRedisForTests(): Promise<RedisTestBackend> {
  for (const url of redisCandidates()) {
    if (await probeRedis(url)) {
      console.info(`[test] Redis: ${url}`);
      return { url, available: true };
    }
  }

  console.warn(
    "[test] Redis unavailable — *.redis.test.ts will be skipped or fail. " +
      `Start Docker: docker compose -f docker-compose.dev.yml up -d`,
  );
  return { url: DEFAULT_TEST_REDIS_URL, available: false };
}

export async function flushRedisDb(url: string): Promise<void> {
  const client = new IORedis(url, { maxRetriesPerRequest: 1 });
  try {
    await client.flushdb();
  } finally {
    await client.quit().catch(() => {});
  }
}

export async function clearMongooseCollections(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;

  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

export async function resetMongooseBetweenTests(): Promise<void> {
  await clearMongooseCollections();

  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }
}

export async function teardownMongoose(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }
}
