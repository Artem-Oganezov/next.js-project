import { internalError, tooManyRequests } from "@/lib/api/errors";
import { getClientIp } from "@/lib/api/http";
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
          return tooManyRequests(
            `Слишком много запросов. Повторите через ${result.retryAfterSec} сек.`,
          );
        }
      }

      return await handler(request);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          scope,
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return internalError();
    }
  };
}
