import { withApiHandler } from "@/lib/api/handler";
import { requireAdminSecret } from "@/lib/admin/auth";
import { isScoreAsyncEnabled } from "@/lib/config/score-async";
import { getCounter, renderPrometheusMetrics } from "@/lib/observability/metrics";
import { getScoreQueueDepth } from "@/lib/queue/score-queue";

export const GET = withApiHandler("metrics", async (request) => {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  let scoreQueueDepth: number | null = null;
  if (isScoreAsyncEnabled()) {
    try {
      scoreQueueDepth = await getScoreQueueDepth();
    } catch {
      scoreQueueDepth = null;
    }
  }

  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("application/json")) {
    return Response.json({
      antiCheatRejections: getCounter("anti_cheat_rejections_total"),
      httpRequests: getCounter("http_requests_total"),
      rateLimitRejected: getCounter("rate_limit_rejected_total"),
      scoreQueueDepth,
    });
  }

  const lines = [renderPrometheusMetrics().trimEnd()];
  if (scoreQueueDepth !== null) {
    lines.push("# TYPE score_queue_depth gauge");
    lines.push(`score_queue_depth ${scoreQueueDepth}`);
  }
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});
