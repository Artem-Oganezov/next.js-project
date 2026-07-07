import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { startGameSessionForUser } from "@/lib/game/start-game-session";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";

describe("startGameSessionForUser", () => {
  let userId: string;

  beforeAll(async () => {
    await connectDB();
    const user = await User.create({
      username: `start_session_${Date.now()}`,
      email: `start_session_${Date.now()}@example.com`,
      passwordHash: "hash",
      emailVerified: true,
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
});
