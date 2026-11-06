import type { MailMessage } from "./mailer.js";
import { emailLayout, longDate } from "./templates.js";

interface Parts {
  to: string;
  name: string;
  subject: string;
  preview: string;
  title: string;
  paragraphs: string[];
  action: string;
  url: string;
  note: string;
  replyTo?: string;
}

function build(parts: Parts): MailMessage {
  const { to, name, subject, paragraphs, action, url, note, replyTo } = parts;
  return {
    to,
    subject,
    html: emailLayout({
      preview: parts.preview,
      title: parts.title,
      name,
      paragraphs,
      action,
      url,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `${action}: ${url}`, note].join("\n\n"),
    ...(replyTo ? { replyTo } : {}),
  };
}

/** Sent after a reset or a signed-in change. Never includes the password. */
export function passwordChangedEmail(
  to: string,
  name: string,
  changedAt: Date,
  resetUrl: string,
  supportEmail: string,
): MailMessage {
  return build({
    to,
    name,
    subject: "Your BillSafi password was changed",
    preview: `Your password was changed on ${longDate.format(changedAt)}.`,
    title: "Your password was changed",
    paragraphs: [
      `Your BillSafi password was changed on ${longDate.format(changedAt)}.`,
      "If this was you, there's nothing more to do.",
      "If it wasn't you, reset your password now.",
    ],
    action: "Reset password",
    url: resetUrl,
    note: `Then write to ${supportEmail} so we can help secure your account.`,
    replyTo: supportEmail,
  });
}

/** Sent when an admin ends every session. It does not mention the admin. */
export function signedOutEverywhereEmail(
  to: string,
  name: string,
  signInUrl: string,
  resetUrl: string,
): MailMessage {
  return build({
    to,
    name,
    subject: "You've been signed out of BillSafi",
    preview: "You've been signed out on all your devices.",
    title: "You've been signed out",
    paragraphs: [
      "You've been signed out of BillSafi on all your devices.",
      "Sign in again to carry on where you left off.",
    ],
    action: "Sign in",
    url: signInUrl,
    note: `If you didn't expect this, reset your password at ${resetUrl}.`,
  });
}

/** Sent after suspension. No reason is shown, and the account is already banned. */
export function accountSuspendedEmail(
  to: string,
  name: string,
  supportEmail: string,
  siteUrl: string,
): MailMessage {
  return build({
    to,
    name,
    subject: "Your BillSafi account is suspended",
    preview: "You can't sign in right now. Your data is safe.",
    title: "Your account is suspended",
    paragraphs: [
      "Your BillSafi account is suspended, so you can't sign in right now.",
      "Your data has not been deleted, and the invoice links you sent your clients still work.",
      `To sort this out, reply to this email or write to ${supportEmail}.`,
    ],
    action: "Visit BillSafi",
    url: siteUrl,
    note: "We'll help you from there.",
    replyTo: supportEmail,
  });
}

export function accountReactivatedEmail(to: string, name: string, signInUrl: string): MailMessage {
  return build({
    to,
    name,
    subject: "Your BillSafi account is active again",
    preview: "You can sign in again.",
    title: "Welcome back",
    paragraphs: [
      "Your BillSafi account is active again, and you can sign in.",
      "Everything is where you left it.",
    ],
    action: "Sign in",
    url: signInUrl,
    note: "If you've forgotten your password, you can reset it from the sign-in page.",
  });
}
