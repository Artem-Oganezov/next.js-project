import { getEnv } from "@/lib/env";

export function getClientIp(request: Request | undefined): string {
  if (!request) {
    return "unknown";
  }

  const { TRUST_PROXY } = getEnv();

  if (TRUST_PROXY) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) {
      return realIp;
    }
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
