import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";

export const GET = withApiHandler("auth/me", async () => {
  const user = await getSessionUser();
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ user });
});
