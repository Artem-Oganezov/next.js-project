import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { consumeAuthToken } from "@/lib/auth/mail-tokens";
import { syncSessionCacheForUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { getAppUrl } from "@/lib/email";
import { User } from "@/lib/models/User";

export const GET = withApiHandler("auth/verify-email", async (request) => {
  const token = new URL(request.url).searchParams.get("token");
  const appUrl = getAppUrl();

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?status=error", appUrl));
  }

  const userId = await consumeAuthToken(token, "email-verify");
  if (!userId) {
    return NextResponse.redirect(new URL("/verify-email?status=error", appUrl));
  }

  await connectDB();
  await User.findByIdAndUpdate(userId, { $set: { emailVerified: true } });
  await syncSessionCacheForUser(userId);

  return NextResponse.redirect(new URL("/verify-email?status=success", appUrl));
});
