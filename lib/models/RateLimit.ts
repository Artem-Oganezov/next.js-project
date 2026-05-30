import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IRateLimit extends Document {
  key: string;
  hits: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    hits: {
      type: Number,
      required: true,
      default: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit ??
  mongoose.model<IRateLimit>("RateLimit", rateLimitSchema);
