import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { loadEnv } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends email through the Gmail account in SMTP_USER / SMTP_PASSWORD (an app password). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: { name: string; address: string } | null;

  constructor() {
    const env = loadEnv();
    if (!env.mailEnabled) {
      this.transport = null;
      this.from = null;
      return;
    }
    this.transport = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    });
    this.from = { name: env.MAIL_FROM_NAME, address: env.SMTP_USER! };
  }

  /** True when the message was handed to Gmail. Failures are logged, never thrown: the caller's work is already saved. */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.transport || !this.from) {
      this.logger.warn(`Email not sent to ${message.to}: SMTP_USER / SMTP_PASSWORD are not set`);
      return false;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...message });
      return true;
    } catch (error) {
      this.logger.error(`Email to ${message.to} failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }
}
