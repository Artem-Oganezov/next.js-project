import nodemailer from "nodemailer";
import type { EmailSender } from "@/lib/email/types";
import { getEnv } from "@/lib/env";

export function createSmtpEmailSender(): EmailSender {
  const env = getEnv();
  const host = env.SMTP_HOST!;
  const port = env.SMTP_PORT ?? 587;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.EMAIL_FROM ?? user ?? "noreply@localhost";

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return {
    async send({ to, subject, text, html }) {
      await transport.sendMail({ from, to, subject, text, html });
    },
  };
}
