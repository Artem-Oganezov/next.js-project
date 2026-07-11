import { connectDB } from "@/lib/db/mongoose";
import { GameSession } from "@/lib/models/GameSession";

/**
 * Undo async enqueue lock when the worker rejects or the queue write fails.
 * Idempotent when the session is already open or fully claimed.
 */
export async function releaseGameSessionPending(sessionId: string): Promise<boolean> {
  await connectDB();

  const released = await GameSession.findOneAndUpdate(
    { _id: sessionId, scoreSubmitted: false, submitPending: true },
    { $set: { submitPending: false } },
  );

  return released !== null;
}

/**
 * Undo an atomic score claim when processing fails after `scoreSubmitted: true`.
 * Idempotent when the session is still open or already rolled back.
 */
export async function releaseGameSessionClaim(sessionId: string): Promise<boolean> {
  await connectDB();

  const released = await GameSession.findOneAndUpdate(
    { _id: sessionId, scoreSubmitted: true },
    { $set: { scoreSubmitted: false, submitPending: false } },
  );

  return released !== null;
}
