import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IGameSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Seed for deterministic obstacle generation on the client. */
  seed: string;
  startedAt: Date;
  /** One-time run: submit atomically sets this flag to true. */
  scoreSubmitted: boolean;
  /** Async enqueue holds the session until the worker claims or rolls back. */
  submitPending: boolean;
  /** Player used revive (ad) — at most once per session. */
  reviveUsed: boolean;
  expiresAt: Date;
}

const gameSessionSchema = new Schema<IGameSession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  seed: {
    type: String,
    required: true,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  scoreSubmitted: {
    type: Boolean,
    default: false,
  },
  submitPending: {
    type: Boolean,
    default: false,
  },
  reviveUsed: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

gameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
gameSessionSchema.index({ userId: 1, scoreSubmitted: 1 });

export const GameSession: Model<IGameSession> =
  mongoose.models.GameSession ??
  mongoose.model<IGameSession>("GameSession", gameSessionSchema);
