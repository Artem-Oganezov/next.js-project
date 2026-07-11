import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { startGameSessionForUser } from "@/lib/game/start-game-session";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";

describe("startGameSessionForUser", () => {
  let userId: string;

  beforeAll(async () => {
    await connectDB();
    const runId = `${Date.now()}_${process.env.VITEST_WORKER_ID ?? "0"}`;
    const user = await User.create({
      username: `start_session_${runId}`,
      email: `start_session_${runId}@example.com`,
      passwordHash: "hash",
      emailVerified: true,
      authProvider: "local",
    });
    userId = user._id.toString();
  });

  it("replaces unsubmitted sessions atomically", async () => {
    const first = await startGameSessionForUser(userId);
    const second = await startGameSessionForUser(userId);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.seed).not.toBe(first.seed);

    const openSessions = await GameSession.countDocuments({
      userId,
      scoreSubmitted: false,
    });
    expect(openSessions).toBe(1);

    const stale = await GameSession.findById(first.sessionId);
    expect(stale).toBeNull();
  });

  it("keeps sessions with a pending async submit when starting a new run", async () => {
    const pending = await GameSession.create({
      userId,
      seed: "pending-seed",
      startedAt: new Date(),
      scoreSubmitted: false,
      submitPending: true,
      reviveUsed: false,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const next = await startGameSessionForUser(userId);

    expect(next.sessionId).not.toBe(pending._id.toString());

    const kept = await GameSession.findById(pending._id);
    expect(kept).not.toBeNull();
    expect(kept?.submitPending).toBe(true);
  });
});
