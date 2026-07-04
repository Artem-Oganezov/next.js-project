import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin } from "@/lib/game/plugin";
import { GameSession } from "@/lib/models/GameSession";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export const POST = withApiHandler(
  "game/session/start",
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    // Лимит и по userId: IP-лимит не спасает от одного залогиненного бота.
    const userLimit = await enforceRateLimit(
      `game:session:user:${sessionUser.id}`,
      RATE_LIMIT.SCORE_MAX_REQUESTS,
      RATE_LIMIT.SCORE_WINDOW_MS,
    );
    if (!userLimit.ok) {
      return tooManyRequests("Слишком много запросов");
    }

    await connectDB();

    // Одна активная партия на юзера: старые незакрытые сессии аннулируются.
    await GameSession.deleteMany({
      userId: sessionUser.id,
      scoreSubmitted: false,
    });

    const startedAt = new Date();
    const gameSession = await GameSession.create({
      userId: sessionUser.id,
      seed: randomBytes(16).toString("hex"),
      startedAt,
      expiresAt: new Date(
        startedAt.getTime() +
          gamePlugin.scoreRules.maxGameDurationMs +
          SESSION_EXPIRY_BUFFER_MS,
      ),
    });

    return NextResponse.json({
      sessionId: gameSession._id.toString(),
      seed: gameSession.seed,
      startedAt: startedAt.toISOString(),
    });
  },
  {
    keyPrefix: "game:session",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
