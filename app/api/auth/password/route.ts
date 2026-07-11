import { NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { hashPassword, verifyLoginPassword } from "@/lib/auth/password";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { msg } from "@/lib/i18n/messages";
import { changePasswordSchema } from "@/lib/validation/auth";

export const PUT = withApiHandler(
  "auth/password",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = changePasswordSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return badRequest("New password must differ from current password");
    }

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    if (!user.passwordHash) {
      return badRequest(msg.auth.googlePasswordUnavailable);
    }

    const valid = await verifyLoginPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return unauthorized("Current password is incorrect");
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await Session.deleteMany({ userId: user._id });
    await destroySession();

    return NextResponse.json({ ok: true });
  },
  {
    keyPrefix: "auth:change-password",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
