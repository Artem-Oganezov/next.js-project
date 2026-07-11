import { connectDB } from "@/lib/db/mongoose";
import { warmLeaderboardIfEmpty } from "@/lib/game/rank";
import { warmRedis } from "@/lib/redis";

/** Eager-connect Mongo and Redis on server boot (avoids cold first request). */
export async function warmConnections(): Promise<void> {
  await Promise.allSettled([connectDB(), warmRedis()]);
  await warmLeaderboardIfEmpty();
}
