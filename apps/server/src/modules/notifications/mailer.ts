import nodemailer from 'nodemailer';
import type { Config } from '../../config/env';
import type { Logger } from '../../lib/logger';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** SMTP when configured; otherwise prints the email to the log (handy in development). */
export function createMailer(config: Config['mail'], logger: Logger): Mailer {
  if (!config.smtp) {
    return {
      async send(message) {
        logger.info(
          { to: message.to, subject: message.subject, text: message.text },
          'email (SMTP not configured, logging instead)',
        );
      },
    };
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });

  return {
    async send(message) {
      await transport.sendMail({ from: config.from, ...message });
    },
  };
}

/** Test double that keeps every message in memory. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  failNext = 0;

  async send(message: MailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('Simulated SMTP failure');
    }
    this.sent.push(message);
  }
}
