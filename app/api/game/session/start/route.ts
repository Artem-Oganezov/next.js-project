import { NextResponse } from "next/server";
import { forbidden, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { assertCanPlay } from "@/lib/game/play-guard";
import { startGameSessionForUser } from "@/lib/game/start-game-session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "game/session/start",
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const playGuard = assertCanPlay(sessionUser);
    if (!playGuard.ok) {
      return forbidden(playGuard.message);
    }

    const userLimit = await enforceRateLimit(
      `game:session:user:${sessionUser.id}`,
      RATE_LIMIT.SCORE_MAX_REQUESTS,
      RATE_LIMIT.SCORE_WINDOW_MS,
    );
    if (!userLimit.ok) {
      return tooManyRequests(msg.game.tooManyRequests);
    }

    const gameSession = await startGameSessionForUser(sessionUser.id);

    return NextResponse.json({
      sessionId: gameSession.sessionId,
      seed: gameSession.seed,
      startedAt: gameSession.startedAt.toISOString(),
    });
  },
  {
    keyPrefix: "game:session",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
