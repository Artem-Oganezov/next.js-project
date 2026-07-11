import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import {
  createAdminSession,
  destroyAdminSession,
  verifyAdminSecretHeader,
} from "@/lib/admin/auth";
import { RATE_LIMIT } from "@/lib/config/app";

export const POST = withApiHandler(
  "admin/session",
  async (request) => {
    const denied = verifyAdminSecretHeader(request);
    if (denied) return denied;

    await createAdminSession();
    return NextResponse.json({ ok: true });
  },
  {
    keyPrefix: "admin:session",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);

export const DELETE = withApiHandler("admin/session", async () => {
  await destroyAdminSession();
  return NextResponse.json({ ok: true });
});
