import { NextResponse } from "next/server";
import { badRequest, forbidden, internalError, unauthorized } from "@/lib/api/errors";
import { validateGameScore } from "@/lib/game/score-rules";
import { getSessionUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { scoreSchema } from "@/lib/validation/score";

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Некорректный JSON");
    }

    const parsed = scoreSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { score } = parsed.data;

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    const validation = validateGameScore(score, user.activeGameStartedAt);
    if (!validation.ok) {
      return forbidden(validation.message);
    }

    const isNewRecord = score > user.bestScore;
    if (isNewRecord) {
      user.bestScore = score;
    }

    user.activeGameStartedAt = null;
    await user.save();

    return NextResponse.json({
      bestScore: user.bestScore,
      isNewRecord,
    });
  } catch (error) {
    console.error("[game/score]", error);
    return internalError();
  }
}
