import { randomUUID } from "crypto";
import { internalError, tooManyRequests } from "@/lib/api/errors";
import { getClientIp } from "@/lib/api/http";
import { incrementCounter } from "@/lib/observability/metrics";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type RateLimitOptions = {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
};

type RouteHandler = (request: Request) => Promise<Response>;

export function withApiHandler(
  scope: string,
  handler: RouteHandler,
  rateLimit?: RateLimitOptions,
): RouteHandler {
  return async (request: Request) => {
    // requestId связывает все логи одного запроса (и отдаётся клиенту
    // в заголовке — удобно сопоставлять баг-репорты с логами сервера).
    const requestId = randomUUID();

    try {
      if (rateLimit) {
        const ip = getClientIp(request);
        const key = `${rateLimit.keyPrefix}:${ip}`;
        const result = await enforceRateLimit(
          key,
          rateLimit.maxRequests,
          rateLimit.windowMs,
        );

        if (!result.ok) {
          const limited = tooManyRequests(
            `Слишком много запросов. Повторите через ${result.retryAfterSec} сек.`,
          );
          limited.headers.set("X-Request-Id", requestId);
          incrementCounter("http_requests_total", {
            scope,
            status: String(limited.status),
          });
          return limited;
        }
      }

      const response = await handler(request);
      response.headers.set("X-Request-Id", requestId);
      incrementCounter("http_requests_total", {
        scope,
        status: String(response.status),
      });
      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          scope,
          requestId,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      const response = internalError();
      response.headers.set("X-Request-Id", requestId);
      incrementCounter("http_requests_total", {
        scope,
        status: String(response.status),
      });
      return response;
    }
  };
}
