import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";
import { getEnv } from "@/lib/env";

const INCR_WITH_EXPIRE_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`;

/**
 * Unified interface over two transports:
 * - REDIS_URL (ioredis, TCP) — VPS / Docker / managed Redis;
 * - UPSTASH_REDIS_REST_* (REST) — serverless deployment.
 *
 * The rest of the codebase depends only on this interface.
 */
export type RedisClient = {
  ping(): Promise<void>;
  get(key: string): Promise<string | null>;
  setEx(key: string, value: string, exSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  /** Atomically INCR and set EXPIRE on first hit (Lua). */
  incrWithExpire(key: string, exSeconds: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  zadd(key: string, entries: { score: number; member: string }[]): Promise<void>;
  zrem(key: string, members: string[]): Promise<void>;
  zcard(key: string): Promise<number>;
  /** How many members have a score strictly greater than the given value. */
  zcountAbove(key: string, score: number): Promise<number>;
  /** First member with a score strictly greater than the given value (nearest above). */
  zfirstAbove(key: string, score: number): Promise<string | null>;
  /** SET key value NX EX — returns true when the key was created. */
  setNx(key: string, value: string, exSeconds: number): Promise<boolean>;
  lpush(key: string, value: string): Promise<void>;
  /** Blocking right pop; null when timeout expires without a value. */
  brpop(key: string, timeoutSeconds: number): Promise<string | null>;
  /** Batch commands in one round-trip (TCP pipeline; REST multi-exec). */
  pipeline(): RedisPipeline;
};

export type RedisPipeline = {
  zadd(key: string, entries: { score: number; member: string }[]): RedisPipeline;
  zcountAbove(key: string, score: number): RedisPipeline;
  zfirstAbove(key: string, score: number): RedisPipeline;
  incr(key: string): RedisPipeline;
  del(key: string): RedisPipeline;
  lpush(key: string, value: string): RedisPipeline;
  setEx(key: string, value: string, exSeconds: number): RedisPipeline;
  exec(): Promise<unknown[]>;
};

function createIoRedisClient(url: string): RedisClient {
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  ioRedisNative = client;
  // Without a handler, ioredis throws an unhandled 'error' when Redis is unavailable.
  client.on("error", () => {});

  const waitUntilReady = (): Promise<void> => {
    if (client.status === "ready") {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        client.off("ready", onReady);
        client.off("error", onError);
      };
      client.once("ready", onReady);
      client.once("error", onError);
    });
  };

  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    await waitUntilReady();
    return operation();
  };

  return {
    async ping() {
      await run(() => client.ping());
    },
    async get(key) {
      return run(() => client.get(key));
    },
    async setEx(key, value, exSeconds) {
      await run(() => client.set(key, value, "EX", exSeconds));
    },
    async del(key) {
      await run(() => client.del(key));
    },
    async incr(key) {
      return run(() => client.incr(key));
    },
    async incrWithExpire(key, exSeconds) {
      return run(async () => {
        const result = await client.eval(
          INCR_WITH_EXPIRE_SCRIPT,
          1,
          key,
          String(exSeconds),
        );
        return Number(result);
      });
    },
    async expire(key, seconds) {
      await run(() => client.expire(key, seconds));
    },
    async ttl(key) {
      return run(() => client.ttl(key));
    },
    async zadd(key, entries) {
      if (entries.length === 0) return;
      await run(() => {
        const args = entries.flatMap((e) => [e.score, e.member]);
        return client.zadd(key, ...args);
      });
    },
    async zrem(key, members) {
      if (members.length === 0) return;
      await run(() => client.zrem(key, ...members));
    },
    async zcard(key) {
      return run(() => client.zcard(key));
    },
    async zcountAbove(key, score) {
      return run(() => client.zcount(key, `(${score}`, "+inf"));
    },
    async zfirstAbove(key, score) {
      return run(async () => {
        const members = await client.zrangebyscore(
          key,
          `(${score}`,
          "+inf",
          "LIMIT",
          0,
          1,
        );
        return members[0] ?? null;
      });
    },
    async setNx(key, value, exSeconds) {
      return run(async () => {
        const result = await client.set(key, value, "EX", exSeconds, "NX");
        return result === "OK";
      });
    },
    async lpush(key, value) {
      await run(() => client.lpush(key, value));
    },
    async brpop(key, timeoutSeconds) {
      return run(async () => {
        const result = await client.brpop(key, timeoutSeconds);
        if (!result) return null;
        return result[1] ?? null;
      });
    },
    pipeline() {
      const pipe = client.pipeline();
      return createIoRedisPipeline(pipe, run);
    },
  };
}

function createIoRedisPipeline(
  pipe: ReturnType<IORedis["pipeline"]>,
  run: <T>(operation: () => Promise<T>) => Promise<T>,
): RedisPipeline {
  const builder: RedisPipeline = {
    zadd(key, entries) {
      if (entries.length > 0) {
        const args = entries.flatMap((e) => [e.score, e.member]);
        pipe.zadd(key, ...args);
      }
      return builder;
    },
    zcountAbove(key, score) {
      pipe.zcount(key, `(${score}`, "+inf");
      return builder;
    },
    zfirstAbove(key, score) {
      pipe.zrangebyscore(key, `(${score}`, "+inf", "LIMIT", 0, 1);
      return builder;
    },
    incr(key) {
      pipe.incr(key);
      return builder;
    },
    del(key) {
      pipe.del(key);
      return builder;
    },
    setEx(key, value, exSeconds) {
      pipe.set(key, value, "EX", exSeconds);
      return builder;
    },
    lpush(key, value) {
      pipe.lpush(key, value);
      return builder;
    },
    async exec() {
      const results = await run(() => pipe.exec());
      if (!results) return [];
      return results.map(([error, value]) => {
        if (error) throw error;
        return value;
      });
    },
  };
  return builder;
}

function createUpstashClient(url: string, token: string): RedisClient {
  const client = new UpstashRedis({
    url,
    token,
    automaticDeserialization: false,
  });

  return {
    async ping() {
      await client.ping();
    },
    async get(key) {
      return client.get<string>(key);
    },
    async setEx(key, value, exSeconds) {
      await client.set(key, value, { ex: exSeconds });
    },
    async del(key) {
      await client.del(key);
    },
    async incr(key) {
      return client.incr(key);
    },
    async incrWithExpire(key, exSeconds) {
      const result = await client.eval(INCR_WITH_EXPIRE_SCRIPT, [key], [
        String(exSeconds),
      ]);
      return Number(result);
    },
    async expire(key, seconds) {
      await client.expire(key, seconds);
    },
    async ttl(key) {
      return client.ttl(key);
    },
    async zadd(key, entries) {
      if (entries.length === 0) return;
      const [first, ...rest] = entries;
      await client.zadd(key, first, ...rest);
    },
    async zrem(key, members) {
      if (members.length === 0) return;
      await client.zrem(key, ...members);
    },
    async zcard(key) {
      return client.zcard(key);
    },
    async zcountAbove(key, score) {
      return client.zcount(key, `(${score}`, "+inf");
    },
    async zfirstAbove(key, score) {
      const members = await client.zrange<string[]>(key, `(${score}`, "+inf", {
        byScore: true,
        offset: 0,
        count: 1,
      });
      return members[0] ?? null;
    },
    async setNx(key, value, exSeconds) {
      const result = await client.set(key, value, { nx: true, ex: exSeconds });
      return result === "OK";
    },
    async lpush(key, value) {
      await client.lpush(key, value);
    },
    async brpop(key, timeoutSeconds) {
      const deadline = Date.now() + timeoutSeconds * 1000;
      while (Date.now() < deadline) {
        const value = await client.rpop<string>(key);
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return null;
    },
    pipeline() {
      const pipe = client.pipeline();
      return createUpstashPipeline(pipe);
    },
  };
}

function createUpstashPipeline(
  pipe: ReturnType<UpstashRedis["pipeline"]>,
): RedisPipeline {
  const builder: RedisPipeline = {
    zadd(key, entries) {
      if (entries.length > 0) {
        const [first, ...rest] = entries;
        pipe.zadd(key, first, ...rest);
      }
      return builder;
    },
    zcountAbove(key, score) {
      pipe.zcount(key, `(${score}`, "+inf");
      return builder;
    },
    zfirstAbove(key, score) {
      pipe.zrange(key, `(${score}`, "+inf", { byScore: true, offset: 0, count: 1 });
      return builder;
    },
    incr(key) {
      pipe.incr(key);
      return builder;
    },
    del(key) {
      pipe.del(key);
      return builder;
    },
    setEx(key, value, exSeconds) {
      pipe.set(key, value, { ex: exSeconds });
      return builder;
    },
    lpush(key, value) {
      pipe.lpush(key, value);
      return builder;
    },
    async exec() {
      const results = await pipe.exec();
      return results as unknown[];
    },
  };
  return builder;
}

let cachedClient: RedisClient | null = null;
let warmPromise: Promise<void> | null = null;
let ioRedisNative: IORedis | null = null;

export function getRedis(): RedisClient {
  if (cachedClient) {
    return cachedClient;
  }

  const env = getEnv();

  if (env.REDIS_URL) {
    cachedClient = createIoRedisClient(env.REDIS_URL);
  } else if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    cachedClient = createUpstashClient(
      env.UPSTASH_REDIS_REST_URL,
      env.UPSTASH_REDIS_REST_TOKEN,
    );
  } else {
    // getEnv() guarantees one of the options; this branch is unreachable.
    throw new Error("Redis is not configured");
  }

  return cachedClient;
}

/** Eager TCP/REST handshake so the first API request does not pay connect latency. */
export function warmRedis(): Promise<void> {
  if (!warmPromise) {
    warmPromise = getRedis()
      .ping()
      .catch(() => {})
      .then(() => undefined);
  }
  return warmPromise;
}

/** Reset singleton client (tests, REDIS_URL change). */
export async function resetRedisCache(): Promise<void> {
  if (ioRedisNative) {
    await ioRedisNative.quit().catch(() => {});
  }
  cachedClient = null;
  warmPromise = null;
  ioRedisNative = null;
}

