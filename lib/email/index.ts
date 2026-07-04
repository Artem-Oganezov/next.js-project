import { createConsoleEmailSender } from "@/lib/email/console";
import { createSmtpEmailSender } from "@/lib/email/smtp";
import type { EmailSender } from "@/lib/email/types";
import { getEnv } from "@/lib/env";

let cachedSender: EmailSender | null = null;
let testSender: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (testSender) {
    return testSender;
  }

  if (cachedSender) {
    return cachedSender;
  }

  const env = getEnv();
  cachedSender = env.SMTP_HOST ? createSmtpEmailSender() : createConsoleEmailSender();
  return cachedSender;
}

/** Override sender in tests. Pass null to reset. */
export function setEmailSenderForTests(sender: EmailSender | null): void {
  testSender = sender;
}

export function resetEmailSenderCache(): void {
  cachedSender = null;
}

export function getAppUrl(): string {
  const { APP_URL } = getEnv();
  return APP_URL ?? "http://localhost:3000";
}
