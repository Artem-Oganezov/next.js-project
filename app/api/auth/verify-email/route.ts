import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { consumeAuthToken } from "@/lib/auth/mail-tokens";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";

export const GET = withApiHandler("auth/verify-email", async (request) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return badRequest("Token is required");
  }

  const userId = await consumeAuthToken(token, "email-verify");
  if (!userId) {
    return badRequest("Invalid or expired verification link");
  }

  await connectDB();

  await User.findByIdAndUpdate(userId, { $set: { emailVerified: true } });

  return NextResponse.json({ ok: true, emailVerified: true });
});
