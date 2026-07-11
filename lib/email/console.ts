import type { EmailSender, SendEmailParams } from "@/lib/email/types";

export function createConsoleEmailSender(): EmailSender {
  return {
    async send(params: SendEmailParams): Promise<void> {
      const includeBody = process.env.NODE_ENV === "development";
      console.info(
        JSON.stringify({
          level: "info",
          scope: "email",
          to: params.to,
          subject: params.subject,
          ...(includeBody ? { text: params.text } : {}),
        }),
      );
    },
  };
}
