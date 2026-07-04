export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSender = {
  send(params: SendEmailParams): Promise<void>;
};
