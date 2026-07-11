import type { Types } from "mongoose";
import {
  invalidateAllSessionCachesForUser,
} from "@/lib/auth/session";
import {
  ANTI_CHEAT_AUTO_BAN_THRESHOLD,
  ANTI_CHEAT_AUTO_BAN_WINDOW_SEC,
} from "@/lib/config/anti-cheat";
import { connectDB } from "@/lib/db/mongoose";
import { removeLeaderboardEntry } from "@/lib/cache/leaderboard";
import { SuspiciousSubmit } from "@/lib/models/SuspiciousSubmit";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { incrementCounter } from "@/lib/observability/metrics";
import { antiCheatMetricLabel } from "@/lib/security/anti-cheat-reasons";
import { getRedis } from "@/lib/redis";
import { purgeUserPlatformState } from "@/lib/user/platform-removal";

export type SuspiciousSubmitDetails = {
  userId: string | Types.ObjectId;
  username: string;
  score: number;
  reason: string;
  elapsedMs: number | null;
};

function antiCheatCounterKey(userId: string): string {
  return `anticheat:reject:${userId}`;
}

async function maybeAutoBanUser(
  userId: string,
  username: string,
  reason: string,
): Promise<void> {
  try {
    const redis = getRedis();
    const key = antiCheatCounterKey(userId);
    const hits = await redis.incrWithExpire(key, ANTI_CHEAT_AUTO_BAN_WINDOW_SEC);

    if (hits < ANTI_CHEAT_AUTO_BAN_THRESHOLD) {
      return;
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          isBanned: true,
          bannedAt: new Date(),
          banReason: `auto-ban:anti-cheat:${reason}`,
        },
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return;
    }

    await purgeUserPlatformState(user._id.toString(), user.username);
    await Session.deleteMany({ userId: user._id });
    await invalidateAllSessionCachesForUser(user._id.toString());
    await removeLeaderboardEntry(user.username);

    incrementCounter("anti_cheat_auto_bans_total", {
      reason: antiCheatMetricLabel(reason),
    });

    console.warn(
      JSON.stringify({
        level: "warn",
        scope: "anti-cheat",
        action: "auto-ban",
        userId,
        username,
        hits,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "anti-cheat-auto-ban",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }
}

/**
 * Log to stderr + counter + Mongo record for the admin panel.
 * Persistence errors are not propagated — the submit is already rejected.
 */
export async function recordSuspiciousSubmit(
  details: SuspiciousSubmitDetails,
): Promise<void> {
  const userId = details.userId.toString();

  console.warn(JSON.stringify({ level: "warn", scope: "anti-cheat", ...details }));

  incrementCounter("anti_cheat_rejections_total", {
    reason: antiCheatMetricLabel(details.reason),
  });

  try {
    await connectDB();
    await SuspiciousSubmit.create({
      userId: details.userId,
      username: details.username,
      score: details.score,
      reason: details.reason,
      elapsedMs: details.elapsedMs,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "anti-cheat-persist",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }

  void maybeAutoBanUser(userId, details.username, details.reason);
}
