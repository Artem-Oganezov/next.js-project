import type { EmailSender, SendEmailParams } from "@/lib/email/types";

export function createConsoleEmailSender(): EmailSender {
  return {
    async send(params: SendEmailParams): Promise<void> {
      console.info(
        JSON.stringify({
          level: "info",
          scope: "email",
          to: params.to,
          subject: params.subject,
          text: params.text,
        }),
      );
    },
  };
}
