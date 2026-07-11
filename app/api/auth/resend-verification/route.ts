import { NextResponse } from "next/server";
import { badRequest, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { sendVerificationEmail } from "@/lib/auth/mail";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "auth/resend-verification",
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    if (sessionUser.emailVerified) {
      return badRequest(msg.auth.emailAlreadyVerified);
    }

    const userLimit = await enforceRateLimit(
      `auth:resend:user:${sessionUser.id}`,
      1,
      RATE_LIMIT.RESEND_VERIFY_COOLDOWN_MS,
    );
    if (!userLimit.ok) {
      return tooManyRequests(msg.common.tooManyRequests);
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
