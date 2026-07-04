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
 * Единый интерфейс поверх двух транспортов:
 * - REDIS_URL (ioredis, TCP) — VPS / Docker / managed Redis;
 * - UPSTASH_REDIS_REST_* (REST) — serverless-деплой.
 *
 * Остальной код зависит только от этого интерфейса.
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
  zcard(key: string): Promise<number>;
  /** Сколько элементов имеют score строго больше указанного. */
  zcountAbove(key: string, score: number): Promise<number>;
  /** Первый member со score строго больше указанного (ближайший сверху). */
  zfirstAbove(key: string, score: number): Promise<string | null>;
};

function createIoRedisClient(url: string): RedisClient {
  const client = new IORedis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  // Без обработчика ioredis бросает unhandled 'error' при недоступном Redis.
  client.on("error", () => {});

  return {
    async ping() {
      await client.ping();
    },
    async get(key) {
      return client.get(key);
    },
    async setEx(key, value, exSeconds) {
      await client.set(key, value, "EX", exSeconds);
    },
    async del(key) {
      await client.del(key);
    },
    async incr(key) {
      return client.incr(key);
    },
    async incrWithExpire(key, exSeconds) {
      const result = await client.eval(
        INCR_WITH_EXPIRE_SCRIPT,
        1,
        key,
        String(exSeconds),
      );
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
      const args = entries.flatMap((e) => [e.score, e.member]);
      await client.zadd(key, ...args);
    },
    async zcard(key) {
      return client.zcard(key);
    },
    async zcountAbove(key, score) {
      return client.zcount(key, `(${score}`, "+inf");
    },
    async zfirstAbove(key, score) {
      const members = await client.zrangebyscore(
        key,
        `(${score}`,
        "+inf",
        "LIMIT",
        0,
        1,
      );
      return members[0] ?? null;
    },
  };
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
  };
}

let cachedClient: RedisClient | null = null;

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
    // getEnv() гарантирует один из вариантов; ветка недостижима.
    throw new Error("Redis is not configured");
  }

  return cachedClient;
}

/** Сброс singleton-клиента (тесты, смена REDIS_URL). */
export function resetRedisCache(): void {
  cachedClient = null;
}
