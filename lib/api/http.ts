export function getClientIp(request: Request | undefined): string {
  if (!request) {
    return "unknown";
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function parseJsonBody(request: Request): Promise<
  | { ok: true; data: unknown }
  | { ok: false; response: Response }
> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    const { badRequest } = await import("@/lib/api/errors");
    return { ok: false, response: badRequest("Некорректный JSON") };
  }
}
