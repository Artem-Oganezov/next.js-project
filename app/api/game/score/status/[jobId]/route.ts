import { NextResponse } from "next/server";
import { notFound, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUserId } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { getScoreJob } from "@/lib/queue/score-queue";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { msg } from "@/lib/i18n/messages";

type RouteParams = { params: Promise<{ jobId: string }> };

function scoreStatusHandler(jobId: string) {
  return withApiHandler(
    "game/score/status",
    async () => {
      const userId = await getSessionUserId();
      if (!userId) {
        return unauthorized();
      }

      const userLimit = await enforceRateLimit(
        `game:score:status:user:${userId}`,
        RATE_LIMIT.SCORE_STATUS_MAX_REQUESTS,
        RATE_LIMIT.SCORE_STATUS_WINDOW_MS,
      );
      if (!userLimit.ok) {
        return tooManyRequests(msg.game.tooManyRequests);
      }

      const job = await getScoreJob(jobId);
      if (!job || job.userId !== userId) {
        return notFound(msg.game.scoreJobNotFound);
      }

      if (job.status === "completed" && job.result) {
        return NextResponse.json({
          status: "completed" as const,
          ...job.result,
        });
      }

      if (job.status === "failed") {
        return NextResponse.json({
          status: "failed" as const,
          message: job.message ?? msg.game.saveFailed,
        });
      }

      return NextResponse.json({
        status: job.status,
      });
    },
    {
      keyPrefix: "game:score:status",
      maxRequests: RATE_LIMIT.SCORE_STATUS_MAX_REQUESTS,
      windowMs: RATE_LIMIT.SCORE_STATUS_WINDOW_MS,
    },
  );
}

export async function GET(request: Request, { params }: RouteParams) {
  const { jobId } = await params;
  return scoreStatusHandler(jobId)(request);
}
