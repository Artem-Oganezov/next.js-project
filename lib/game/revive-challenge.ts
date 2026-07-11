import {
  REVIVE_CHALLENGE_MIN_MS,
  REVIVE_CHALLENGE_TTL_SEC,
} from "@/lib/config/anti-cheat";
import { getRedis } from "@/lib/redis";

const CHALLENGE_PREFIX = "revive:challenge:";

function challengeKey(sessionId: string): string {
  return `${CHALLENGE_PREFIX}${sessionId}`;
}

export type ReviveChallengeResult =
  | { ok: true; minWaitMs: number }
  | { ok: false; code: "redis-unavailable" };

export async function issueReviveChallenge(
  sessionId: string,
): Promise<ReviveChallengeResult> {
  try {
    const redis = getRedis();
    const notBefore = (Date.now() + REVIVE_CHALLENGE_MIN_MS).toString();
    await redis.setEx(
      challengeKey(sessionId),
      notBefore,
      REVIVE_CHALLENGE_TTL_SEC,
    );
    return { ok: true, minWaitMs: REVIVE_CHALLENGE_MIN_MS };
  } catch {
    return { ok: false, code: "redis-unavailable" };
  }
}

export type PeekReviveChallengeResult =
  | { ok: true }
  | { ok: false; code: "missing" | "too-early" | "redis-unavailable" };

/** Read-only timing gate; does not consume the challenge. */
export async function peekReviveChallenge(
  sessionId: string,
): Promise<PeekReviveChallengeResult> {
  try {
    const redis = getRedis();
    const notBeforeRaw = await redis.get(challengeKey(sessionId));
    if (!notBeforeRaw) {
      return { ok: false, code: "missing" };
    }

    const notBefore = Number(notBeforeRaw);
    if (!Number.isFinite(notBefore)) {
      return { ok: false, code: "missing" };
    }

    if (Date.now() < notBefore) {
      return { ok: false, code: "too-early" };
    }

    return { ok: true };
  } catch {
    return { ok: false, code: "redis-unavailable" };
  }
}

export async function clearReviveChallenge(sessionId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(challengeKey(sessionId));
  } catch {
    // Best-effort cleanup after a successful revive claim.
  }
}

export type ConsumeReviveChallengeResult =
  | { ok: true }
  | { ok: false; code: "missing" | "too-early" | "redis-unavailable" };

/** @deprecated Prefer peekReviveChallenge + clearReviveChallenge in the revive route. */
export async function consumeReviveChallenge(
  sessionId: string,
): Promise<ConsumeReviveChallengeResult> {
  const peek = await peekReviveChallenge(sessionId);
  if (!peek.ok) {
    return peek;
  }
  await clearReviveChallenge(sessionId);
  return { ok: true };
}
