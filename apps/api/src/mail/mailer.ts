import nodemailer, { type Transporter } from "nodemailer";
import type { ActivityRecorder } from "../activity/activity-recorder.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Which kind of email this is, so a failed send can be recorded by name (D066). */
export interface MailContext {
  /** For example password_reset_email or renewal_reminder. */
  operation: string;
  /** The account the email is about, when there is one. */
  accountId?: string | null;
}

export interface Mailer {
  send(message: MailMessage, context: MailContext): Promise<void>;
}

/** Records a failed send (kind email) and rethrows, so callers handle it as before. */
export class RecordingMailer implements Mailer {
  constructor(
    private readonly inner: Mailer,
    private readonly recorder: Pick<ActivityRecorder, "failure">,
  ) {}

  async send(message: MailMessage, context: MailContext): Promise<void> {
    try {
      await this.inner.send(message, context);
    } catch (error) {
      this.recorder.failure("email", context.operation, error, context.accountId ?? null);
      throw error;
    }
  }
}

/** SMTP transport for Resend or an explicitly configured alternative relay. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(message: MailMessage, _context?: MailContext): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
