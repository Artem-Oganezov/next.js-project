import { getAppUrl, getEmailSender } from "@/lib/email";
import {
  EMAIL_VERIFY_TTL_MS,
  issueAuthToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/auth/mail-tokens";

export async function sendVerificationEmail(
  userId: string,
  email: string,
): Promise<void> {
  const token = await issueAuthToken(userId, "email-verify", EMAIL_VERIFY_TTL_MS);
  const link = `${getAppUrl()}/api/auth/verify-email?token=${token}`;

  await getEmailSender().send({
    to: email,
    subject: "Verify your email",
    text: `Confirm your email by opening this link (valid 24h):\n${link}`,
  });
}

export async function sendPasswordResetEmail(
  userId: string,
  email: string,
): Promise<void> {
  const token = await issueAuthToken(userId, "password-reset", PASSWORD_RESET_TTL_MS);
  const link = `${getAppUrl()}/reset-password?token=${token}`;

  await getEmailSender().send({
    to: email,
    subject: "Reset your password",
    text: `Reset your password using this link (valid 1h):\n${link}`,
  });
}
