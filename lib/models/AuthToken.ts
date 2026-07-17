import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type AuthTokenType = "email-verify" | "password-reset";

export interface IAuthToken extends Document {
  userId: Types.ObjectId;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
}

const authTokenSchema = new Schema<IAuthToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["email-verify", "password-reset"],
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthToken: Model<IAuthToken> =
  mongoose.models.AuthToken ?? mongoose.model<IAuthToken>("AuthToken", authTokenSchema);
