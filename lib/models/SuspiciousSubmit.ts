import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface ISuspiciousSubmit extends Document {
  userId: Types.ObjectId;
  username: string;
  score: number;
  reason: string;
  elapsedMs: number | null;
  createdAt: Date;
}

const suspiciousSubmitSchema = new Schema<ISuspiciousSubmit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true },
    score: { type: Number, required: true },
    reason: { type: String, required: true },
    elapsedMs: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

suspiciousSubmitSchema.index({ createdAt: -1 });

export const SuspiciousSubmit: Model<ISuspiciousSubmit> =
  mongoose.models.SuspiciousSubmit ??
  mongoose.model<ISuspiciousSubmit>("SuspiciousSubmit", suspiciousSubmitSchema);
