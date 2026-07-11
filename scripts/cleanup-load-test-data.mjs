/**
 * One-off cleanup after k6 load tests. Run: node scripts/cleanup-load-test-data.mjs
 * Deletes test users from Mongo + leaderboard entries from Redis.
 */
import { readFileSync } from "fs";
import { join } from "path";
import mongoose from "mongoose";

const TEST_USER_REGEX =
  /^(k6_|k6|load_|cap_|stress_|test_)/i;

function loadEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).replace(/^\uFEFF/, "");
      process.env[key] = line.slice(idx + 1);
    }
  }
}

loadEnvLocal();

const uri = process.env.MONGODB_URI;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!uri) {
  console.error("MONGODB_URI missing");
  process.exit(1);
}

await mongoose.connect(uri);

const db = mongoose.connection.db;
const users = db.collection("users");
const sessions = db.collection("sessions");
const gameSessions = db.collection("gamesessions");

const testUsers = await users
  .find(
    {
      $or: [
        { username: { $regex: TEST_USER_REGEX } },
        { email: { $regex: /@(k6\.local|example\.com)$/i } },
      ],
    },
    { projection: { _id: 1, username: 1 } },
  )
  .toArray();

const userIds = testUsers.map((u) => u._id);
const usernames = testUsers.map((u) => u.username);

console.log(`Mongo: found ${testUsers.length} test users`);

if (userIds.length > 0) {
  const [u, s, g] = await Promise.all([
    users.deleteMany({ _id: { $in: userIds } }),
    sessions.deleteMany({ userId: { $in: userIds } }),
    gameSessions.deleteMany({ userId: { $in: userIds } }),
  ]);
  console.log(`Mongo deleted: users=${u.deletedCount} sessions=${s.deletedCount} gameSessions=${g.deletedCount}`);
}

await mongoose.disconnect();

if (redisUrl && redisToken && usernames.length > 0) {
  const base = redisUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${redisToken}`,
    "Content-Type": "application/json",
  };

  for (const username of usernames) {
    await fetch(`${base}/zrem/lb:scores/${encodeURIComponent(username)}`, {
      method: "POST",
      headers,
    }).catch(() => {});
  }

  await fetch(`${base}/del/lb:top10/lb:top10:gen`, { method: "POST", headers }).catch(() => {});

  console.log(`Redis: zrem ${usernames.length} leaderboard members, invalidated top10 cache`);
} else {
  console.log("Redis: skipped (no Upstash creds or no users)");
}

console.log("Cleanup done.");
