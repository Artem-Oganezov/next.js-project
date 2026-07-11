import { getEnv } from "@/lib/env";

let trustProxyProductionWarningLogged = false;
let trustProxyDevSpoofWarningLogged = false;

/** Reset logging flags (tests). */
export function resetClientIpState(): void {
  trustProxyProductionWarningLogged = false;
  trustProxyDevSpoofWarningLogged = false;
}

export function getClientIp(request: Request | undefined): string {
  if (!request) {
    return "unknown";
  }

  const env = getEnv();
  const { TRUST_PROXY, NODE_ENV } = env;

  if (TRUST_PROXY) {
    if (NODE_ENV === "development" && !trustProxyDevSpoofWarningLogged) {
      trustProxyDevSpoofWarningLogged = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          scope: "http",
          message:
            "TRUST_PROXY is true in development — clients can spoof X-Forwarded-For and bypass rate limits. Set TRUST_PROXY=false when Next.js is accessed directly.",
        }),
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
  } else if (NODE_ENV === "production" && !trustProxyProductionWarningLogged) {
    trustProxyProductionWarningLogged = true;
    console.warn(
      JSON.stringify({
        level: "warn",
        scope: "http",
        message:
          "TRUST_PROXY is false in production — rate limits share one bucket (unknown IP). Set TRUST_PROXY=true behind a reverse proxy.",
      }),
    );
  }

  return "unknown";
}

export async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    const { badRequest } = await import("@/lib/api/errors");
    const { msg } = await import("@/lib/i18n/messages");
    return { ok: false, response: badRequest(msg.common.invalidJson) };
  }
}
