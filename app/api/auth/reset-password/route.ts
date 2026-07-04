import { NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { hashPassword } from "@/lib/auth/password";
import { consumeAuthToken } from "@/lib/auth/mail-tokens";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { resetPasswordSchema } from "@/lib/validation/auth";

export const POST = withApiHandler(
  "auth/reset-password",
  async (request) => {
    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = resetPasswordSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const userId = await consumeAuthToken(parsed.data.token, "password-reset");
    if (!userId) {
      return unauthorized("Invalid or expired reset token");
    }

    await connectDB();

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { passwordHash } },
      { returnDocument: "after" },
    );

    if (!user) {
      return unauthorized("Invalid or expired reset token");
    }

    await Session.deleteMany({ userId: user._id });

    return NextResponse.json({ ok: true });
  },
  {
    keyPrefix: "auth:reset-password",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
