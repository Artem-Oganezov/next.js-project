import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { SuspiciousSubmit } from "@/lib/models/SuspiciousSubmit";
import { incrementCounter } from "@/lib/observability/metrics";
import { antiCheatMetricLabel } from "@/lib/security/anti-cheat-reasons";

export type SuspiciousSubmitDetails = {
  userId: string | Types.ObjectId;
  username: string;
  score: number;
  reason: string;
  elapsedMs: number | null;
};

/**
 * Лог в stderr + счётчик + запись в Mongo для админки.
 * Ошибки персистенции не пробрасываются — сабмит уже отклонён.
 */
export async function recordSuspiciousSubmit(
  details: SuspiciousSubmitDetails,
): Promise<void> {
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
}
