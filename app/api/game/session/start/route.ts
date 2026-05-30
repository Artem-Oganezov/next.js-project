import { NextResponse } from "next/server";
import { internalError, unauthorized } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";

export async function POST() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    user.activeGameStartedAt = new Date();
    await user.save();

    return NextResponse.json({
      startedAt: user.activeGameStartedAt.toISOString(),
    });
  } catch (error) {
    console.error("[game/session/start]", error);
    return internalError();
  }
}
