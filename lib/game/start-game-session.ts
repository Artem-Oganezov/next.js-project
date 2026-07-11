import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin } from "@/lib/game/plugin";
import { GameSession } from "@/lib/models/GameSession";

const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export type StartedGameSession = {
  sessionId: string;
  seed: string;
  startedAt: Date;
};

/**
 * Atomically revoke unsubmitted runs and create a new GameSession in one Mongo round-trip.
 */
export async function startGameSessionForUser(userId: string): Promise<StartedGameSession> {
  await connectDB();

  const startedAt = new Date();
  const seed = randomBytes(16).toString("hex");
  const expiresAt = new Date(
    startedAt.getTime() +
      gamePlugin.scoreRules.maxGameDurationMs +
      SESSION_EXPIRY_BUFFER_MS,
  );
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await GameSession.collection.bulkWrite([
    {
      deleteMany: {
        filter: {
          userId: userObjectId,
          scoreSubmitted: false,
          submitPending: { $ne: true },
        },
      },
    },
    {
      insertOne: {
        document: {
          userId: userObjectId,
          seed,
          startedAt,
          scoreSubmitted: false,
          submitPending: false,
          reviveUsed: false,
          expiresAt,
        },
      },
    },
  ]);

  const insertedId = result.insertedIds
    ? (Object.values(result.insertedIds)[0] as mongoose.Types.ObjectId | undefined)
    : undefined;
  if (!insertedId) {
    throw new Error("Failed to create game session");
  }

  return {
    sessionId: insertedId.toString(),
    seed,
    startedAt,
  };
}
