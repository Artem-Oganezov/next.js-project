import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { destroySession } from "@/lib/auth/session";

export const POST = withApiHandler("auth/logout", async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
