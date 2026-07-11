import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { APP_VERSION } from "@/lib/config/version";
import { connectDB } from "@/lib/db/mongoose";
import { getRedis } from "@/lib/redis";

async function checkMongo(): Promise<boolean> {
  try {
    const conn = await connectDB();
    return conn.connection.readyState === 1;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    await getRedis().ping();
    return true;
  } catch {
    return false;
  }
}

export const GET = withApiHandler("health", async () => {
  const [mongoOk, redisOk] = await Promise.all([checkMongo(), checkRedis()]);

  // Redis degrades the service (no cache and rate limit) but does not take it down.
  const ok = mongoOk;

  return NextResponse.json(
    {
      status: ok ? (redisOk ? "ok" : "degraded") : "down",
      version: APP_VERSION,
      mongo: mongoOk ? "connected" : "disconnected",
      redis: redisOk ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
});
