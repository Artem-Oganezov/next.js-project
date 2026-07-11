import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { sendPasswordResetEmail } from "@/lib/auth/mail";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { msg } from "@/lib/i18n/messages";
import { forgotPasswordSchema } from "@/lib/validation/auth";

const GENERIC_MESSAGE =
  "If an account exists for this email, a reset link has been sent.";

export const POST = withApiHandler(
  "auth/forgot-password",
  async (request) => {
    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = forgotPasswordSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    await connectDB();

    const user = await User.findOne({ email: parsed.data.email });
    if (user?.passwordHash) {
      try {
        await sendPasswordResetEmail(user._id.toString(), user.email);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            scope: "auth/forgot-password",
            message: error instanceof Error ? error.message : "email send failed",
          }),
        );
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  },
  {
    keyPrefix: "auth:forgot-password",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
