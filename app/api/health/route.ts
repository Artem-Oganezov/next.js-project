import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { APP_VERSION } from "@/lib/config/version";
import { RATE_LIMIT } from "@/lib/config/app";
import { isScoreAsyncEnabled } from "@/lib/config/score-async";
import { connectDB } from "@/lib/db/mongoose";
import { getScoreQueueDepth } from "@/lib/queue/score-queue";
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

export const GET = withApiHandler(
  "health",
  async () => {
    const [mongoOk, redisOk] = await Promise.all([checkMongo(), checkRedis()]);

    let scoreQueueDepth: number | null = null;
    if (redisOk && isScoreAsyncEnabled()) {
      try {
        scoreQueueDepth = await getScoreQueueDepth();
      } catch {
        scoreQueueDepth = null;
      }
    }

    const ok = mongoOk;

    return NextResponse.json(
      {
        status: ok ? (redisOk ? "ok" : "degraded") : "down",
        version: APP_VERSION,
        mongo: mongoOk ? "connected" : "disconnected",
        redis: redisOk ? "connected" : "disconnected",
        scoreQueueDepth,
        timestamp: new Date().toISOString(),
      },
      { status: ok ? 200 : 503 },
    );
  },
  {
    keyPrefix: "health",
    maxRequests: RATE_LIMIT.HEALTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.HEALTH_WINDOW_MS,
  },
);
