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

/** Resend uses HTTPS so delivery works on hosts that block outbound SMTP. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage, _context?: MailContext): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...message, from: this.from, to: [message.to] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Do not log provider bodies: they may contain recipients or message content.
      throw new Error(`Resend email delivery failed (HTTP ${response.status})`);
    }
  }
}

/** SMTP transport for an explicitly configured alternative relay. */
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
