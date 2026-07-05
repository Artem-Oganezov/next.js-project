import { z } from "zod";
import { msg } from "@/lib/i18n/messages";

const usernameField = z
  .string()
  .trim()
  .min(3, msg.auth.usernameMin)
  .max(30, msg.auth.usernameMax)
  .regex(/^[a-zA-Z0-9_]+$/, msg.auth.usernameFormat);

const passwordField = z
  .string()
  .min(8, msg.auth.passwordMin)
  .max(128, msg.auth.passwordMax);

export const registerSchema = z.object({
  username: usernameField,
  email: z.email(msg.auth.invalidEmail).trim().toLowerCase(),
  password: passwordField,
});

export const loginSchema = z.object({
  username: usernameField,
  password: passwordField,
});

export const forgotPasswordSchema = z.object({
  email: z.email(msg.auth.invalidEmail).trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, msg.auth.verifyTokenRequired),
  password: passwordField,
});

export const changePasswordSchema = z.object({
  currentPassword: passwordField,
  newPassword: passwordField,
});

export const deleteAccountSchema = z.object({
  password: passwordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
