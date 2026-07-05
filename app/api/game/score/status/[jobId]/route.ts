import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { getScoreJob } from "@/lib/queue/score-queue";
import { msg } from "@/lib/i18n/messages";

type RouteParams = { params: Promise<{ jobId: string }> };

function scoreStatusHandler(jobId: string) {
  return withApiHandler("game/score/status", async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const job = await getScoreJob(jobId);
    if (!job || job.userId !== sessionUser.id) {
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
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  const { jobId } = await params;
  return scoreStatusHandler(jobId)(request);
}
