import { NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { sendVerificationEmail } from "@/lib/auth/mail";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";

export const POST = withApiHandler(
  "auth/resend-verification",
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    if (sessionUser.emailVerified) {
      return badRequest("Email is already verified");
    }

    await connectDB();
    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    await sendVerificationEmail(user._id.toString(), user.email);

    return NextResponse.json({ ok: true });
  },
  {
    keyPrefix: "auth:resend-verification",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
