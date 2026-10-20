import type { MailMessage } from "./mailer.js";

export function passwordResetEmail(to: string, name: string, url: string): MailMessage {
  return {
    to,
    subject: "Reset your Billsafi password",
    text: [
      `Hi ${name},`,
      "",
      "Someone requested to reset the password for your Billsafi account.",
      "Use this link within the next hour to choose a new password:",
      "",
      url,
      "",
      "Resetting your password signs you out on every device.",
      "If you didn't ask for this, you can ignore this email.",
    ].join("\n"),
  };
}

const longDate = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

/** Renewal reminder three days before and on the day Pro ends (D051). */
export function renewalReminderEmail(
  to: string,
  name: string,
  expiresAt: Date,
  billingUrl: string,
  kind: "before_expiry" | "on_expiry",
): MailMessage {
  const when = longDate.format(expiresAt);
  return {
    to,
    subject: kind === "on_expiry" ? "Your Billsafi Pro ends today" : "Your Billsafi Pro ends soon",
    text: [
      `Hi ${name},`,
      "",
      kind === "on_expiry"
        ? `Your Pro access ends today, ${when}.`
        : `Your Pro access ends on ${when}.`,
      "Billsafi never takes payment automatically. To keep Pro, renew with M-Pesa here:",
      "",
      billingUrl,
      "",
      "Renewing early adds a month to your current end date. If Pro ends, your businesses, invoices, and payment records stay available on the Free plan.",
    ].join("\n"),
  };
}
