import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IGameSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Seed для детерминированной генерации препятствий на клиенте. */
  seed: string;
  startedAt: Date;
  /** Партия одноразовая: submit атомарно переводит флаг в true. */
  scoreSubmitted: boolean;
  /** Игрок использовал revive (реклама) — не более одного раза за сессию. */
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

export const GameSession: Model<IGameSession> =
  mongoose.models.GameSession ??
  mongoose.model<IGameSession>("GameSession", gameSessionSchema);
