import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { RateLimit } from "@/lib/models/RateLimit";
import { afterAll, afterEach, vi } from "vitest";

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

const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

afterEach(async () => {
  clearTestCookies();

  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }

  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    await RateLimit.deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoServer.stop();
});
