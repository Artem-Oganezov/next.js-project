import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import {
  releaseGameSessionClaim,
  releaseGameSessionPending,
} from "@/lib/game/session-claim";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";

describe("releaseGameSessionClaim", () => {
  let userId: string;

  beforeAll(async () => {
    await connectDB();
    const runId = `${Date.now()}_${process.env.VITEST_WORKER_ID ?? "0"}`;
    const user = await User.create({
      username: `claim_release_${runId}`,
      email: `claim_release_${runId}@example.com`,
      passwordHash: "hash",
      emailVerified: true,
      authProvider: "local",
    });
    userId = user._id.toString();
  });

  it("rolls back scoreSubmitted after a failed claim", async () => {
    const session = await GameSession.create({
      userId,
      seed: "seed",
      startedAt: new Date(),
      scoreSubmitted: true,
      reviveUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const released = await releaseGameSessionClaim(session._id.toString());
    expect(released).toBe(true);

    const updated = await GameSession.findById(session._id);
    expect(updated?.scoreSubmitted).toBe(false);
  });

  it("is idempotent when the session is still open", async () => {
    const session = await GameSession.create({
      userId,
      seed: "seed2",
      startedAt: new Date(),
      scoreSubmitted: false,
      reviveUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const released = await releaseGameSessionClaim(session._id.toString());
    expect(released).toBe(false);

    const updated = await GameSession.findById(session._id);
    expect(updated?.scoreSubmitted).toBe(false);
  });

  it("clears submitPending when async enqueue is rolled back", async () => {
    const session = await GameSession.create({
      userId,
      seed: "pending",
      startedAt: new Date(),
      scoreSubmitted: false,
      submitPending: true,
      reviveUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const released = await releaseGameSessionPending(session._id.toString());
    expect(released).toBe(true);

    const updated = await GameSession.findById(session._id);
    expect(updated?.submitPending).toBe(false);
    expect(updated?.scoreSubmitted).toBe(false);
  });
});
