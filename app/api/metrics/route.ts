import { unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getEnv } from "@/lib/env";
import { requireAdminSecret } from "@/lib/admin/auth";
import { getCounter, renderPrometheusMetrics } from "@/lib/observability/metrics";

export const GET = withApiHandler("metrics", async (request) => {
  const { ADMIN_SECRET, NODE_ENV } = getEnv();

  // In production without ADMIN_SECRET, metrics are not exposed (scraper firewall — ops).
  if (NODE_ENV === "production" && !ADMIN_SECRET) {
    return unauthorized("Metrics are not configured");
  }

  if (ADMIN_SECRET) {
    const denied = requireAdminSecret(request);
    if (denied) return denied;
  }

  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("application/json")) {
    return Response.json({
      antiCheatRejections: getCounter("anti_cheat_rejections_total"),
      httpRequests: getCounter("http_requests_total"),
      rateLimitRejected: getCounter("rate_limit_rejected_total"),
    });
  }

  return new Response(renderPrometheusMetrics(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});
