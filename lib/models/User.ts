import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  bestScore: number;
  totalScore: number;
  unlockedSkins: string[];
  activeSkin: string;
  isBanned: boolean;
  bannedAt: Date | null;
  banReason: string | null;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    bestScore: {
      type: Number,
      default: 0,
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    unlockedSkins: {
      type: [String],
      default: ["default"],
    },
    activeSkin: {
      type: String,
      default: "default",
    },
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    banReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Leaderboard and rank computation sort/filter by bestScore.
userSchema.index({ bestScore: -1 });

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
