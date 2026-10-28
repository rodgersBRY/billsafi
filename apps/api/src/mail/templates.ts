import type { MailMessage } from "./mailer.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

/** Only web links may appear in email buttons, even when called outside auth. */
function webLink(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Email links must use HTTP or HTTPS");
  }
  return escapeHtml(value);
}

function emailLayout(options: {
  preview: string;
  title: string;
  name: string;
  paragraphs: string[];
  action: string;
  url: string;
  note: string;
}): string {
  const link = webLink(options.url);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:0;background-color:#f5f8f7;color:#172b2a;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f8f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e3ebe7;border-radius:16px;">
<tr><td style="padding:32px 32px 24px;border-bottom:1px solid #e3ebe7;font-size:24px;font-weight:bold;color:#0f766e;">BillSafi</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 24px;font-size:28px;line-height:1.25;">${escapeHtml(options.title)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(options.name)},</p>
${options.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join("\n")}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;"><tr><td bgcolor="#0f766e" style="border-radius:8px;mso-padding-alt:14px 24px;"><a href="${link}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(options.action)}</a></td></tr></table>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#627570;">${escapeHtml(options.note)}</p>
<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#627570;">If the button doesn't work, copy this link into your browser:</p>
<p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;overflow-wrap:anywhere;"><a href="${link}" style="color:#0f766e;">${link}</a></p>
</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #e3ebe7;color:#627570;font-size:12px;line-height:1.6;">BillSafi · Invoices made simple.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function passwordResetEmail(
  to: string,
  name: string,
  url: string,
  expiresInSeconds = 3600,
): MailMessage {
  const validity = expiresInSeconds === 3600 ? "one hour" : `${expiresInSeconds} seconds`;
  return {
    to,
    subject: "Reset your BillSafi password",
    html: emailLayout({
      preview: `Choose a new password. This link works for ${validity}.`,
      title: "Reset your password",
      name,
      paragraphs: [
        "We received a request to reset the password for your BillSafi account.",
        `Choose a new password using the button below. This link works once and expires in ${validity}.`,
      ],
      action: "Reset password",
      url,
      note: "Resetting your password signs you out on every device. If you didn't request this, you can ignore this email. Your password will stay the same.",
    }),
    text: [
      `Hi ${name},`,
      "",
      "Someone requested to reset the password for your BillSafi account.",
      `Use this link within ${validity} to choose a new password:`,
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
    subject: kind === "on_expiry" ? "Your BillSafi Pro ends today" : "Your BillSafi Pro ends soon",
    html: emailLayout({
      preview:
        kind === "on_expiry"
          ? "Renew today to keep your Pro features."
          : `Your Pro access ends on ${when}.`,
      title: kind === "on_expiry" ? "Your Pro ends today" : "Keep your business on Pro",
      name,
      paragraphs: [
        kind === "on_expiry"
          ? `Your Pro access ends today, ${when}.`
          : `Your Pro access ends on ${when}.`,
        "Renew with M-Pesa to keep your Pro features. BillSafi never takes payment automatically.",
        "Renewing early adds a month to your current end date.",
      ],
      action: "Renew Pro",
      url: billingUrl,
      note: "If Pro ends, your businesses, invoices, and payment records stay available on the Free plan.",
    }),
    text: [
      `Hi ${name},`,
      "",
      kind === "on_expiry"
        ? `Your Pro access ends today, ${when}.`
        : `Your Pro access ends on ${when}.`,
      "BillSafi never takes payment automatically. To keep Pro, renew with M-Pesa here:",
      "",
      billingUrl,
      "",
      "Renewing early adds a month to your current end date. If Pro ends, your businesses, invoices, and payment records stay available on the Free plan.",
    ].join("\n"),
  };
}
