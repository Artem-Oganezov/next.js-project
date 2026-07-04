import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { connectDB } from "@/lib/db/mongoose";
import { getCounter } from "@/lib/observability/metrics";
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

  // Redis деградирует сервис (нет кэша и rate limit), но не роняет его.
  const ok = mongoOk;

  return NextResponse.json(
    {
      status: ok ? (redisOk ? "ok" : "degraded") : "down",
      mongo: mongoOk ? "connected" : "disconnected",
      redis: redisOk ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      observability: {
        antiCheatRejections: getCounter("anti_cheat_rejections_total"),
        httpRequests: getCounter("http_requests_total"),
        metricsPath: "/api/metrics",
      },
    },
    { status: ok ? 200 : 503 },
  );
});
