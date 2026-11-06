import { FREE_PLAN } from "@billsafi/domain";
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

export function emailLayout(options: {
  preview: string;
  title: string;
  name: string;
  paragraphs: string[];
  action: string;
  url: string;
  note: string;
  /** Shown in the footer of emails people can opt out of. */
  unsubscribeUrl?: string;
}): string {
  const link = webLink(options.url);
  // Every button points at the web app, so the logo is served from the same origin.
  const logo = escapeHtml(new URL("/brand/logo-mark.png", options.url).href);
  const unsubscribe = options.unsubscribeUrl
    ? `<br>You're getting this because you have a BillSafi account. <a href="${webLink(options.unsubscribeUrl)}" style="color:#627570;">Unsubscribe from check-in emails</a>.`
    : "";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:0;background-color:#f5f8f7;color:#172b2a;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f8f7;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e3ebe7;border-radius:16px;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e3ebe7;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="padding-right:10px;vertical-align:middle;"><img src="${logo}" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="vertical-align:middle;font-size:22px;font-weight:bold;color:#0f766e;">BillSafi</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 24px;font-size:28px;line-height:1.25;">${escapeHtml(options.title)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(options.name)},</p>
${options.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`).join("\n")}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;"><tr><td bgcolor="#0f766e" style="border-radius:8px;mso-padding-alt:14px 24px;"><a href="${link}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">${escapeHtml(options.action)}</a></td></tr></table>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#627570;">${escapeHtml(options.note)}</p>
<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#627570;">If the button doesn't work, copy this link into your browser:</p>
<p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;overflow-wrap:anywhere;"><a href="${link}" style="color:#0f766e;">${link}</a></p>
</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #e3ebe7;color:#627570;font-size:12px;line-height:1.6;">BillSafi · Invoices made simple.${unsubscribe}</td></tr>
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

/** Date and time in Nairobi, for example "6 January 2027 at 11:30". */
export const longDate = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

/** Date only in Nairobi, for example "6 January 2027". */
export const dayOnly = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "long",
  year: "numeric",
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

/** Sent once, right after an account is created. */
export function welcomeEmail(to: string, name: string, url: string): MailMessage {
  const paragraphs = [
    "Thanks for signing up for BillSafi.",
    "Start by adding your business name and phone number. Then you can create an invoice, download it as a PDF or share a link on WhatsApp, and record payments as they come in.",
    `You're on the Free plan, which covers ${FREE_PLAN.invoiceLimit} invoices a month.`,
  ];
  const note = "If you didn't create this account, you can ignore this email.";
  return {
    to,
    subject: "Welcome to BillSafi",
    html: emailLayout({
      preview: "Set up your business and send your first invoice.",
      title: "Your account is ready",
      name,
      paragraphs,
      action: "Set up your business",
      url,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `Set up your business: ${url}`, note].join("\n\n"),
  };
}

/** Tells each configured admin about a new account. */
export function registrationAdminEmail(
  to: string,
  name: string,
  user: { id: string; name: string; email: string },
  url: string,
): MailMessage {
  const paragraphs = [
    `${user.name} just created a BillSafi account.`,
    `Email: ${user.email}`,
    `Account ID: ${user.id}`,
  ];
  const note = "You get these emails because you're a BillSafi admin.";
  return {
    to,
    subject: "New BillSafi sign-up",
    html: emailLayout({
      preview: `${user.name} just signed up.`,
      title: "New sign-up",
      name,
      paragraphs,
      action: "View account",
      url,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `View account: ${url}`, note].join("\n\n"),
  };
}

/** Tells the freelancer a client accepted or declined a quote on its public link. */
export function quoteResponseEmail(
  to: string,
  name: string,
  response: {
    decision: "accepted" | "declined";
    quoteNumber: string;
    clientName: string;
    signerName: string | null;
    reason: string | null;
  },
  url: string,
): MailMessage {
  const accepted = response.decision === "accepted";
  const subject = accepted
    ? `${response.clientName} accepted quote ${response.quoteNumber}`
    : `${response.clientName} declined quote ${response.quoteNumber}`;
  const paragraphs = accepted
    ? [
        `${response.signerName} accepted quote ${response.quoteNumber} for ${response.clientName}.`,
        "You can turn it into an invoice in one step.",
      ]
    : [
        `${response.clientName} declined quote ${response.quoteNumber}.`,
        response.reason ? `Their reason: "${response.reason}"` : "They didn't give a reason.",
        "You can edit the quote and send it again.",
      ];
  const action = accepted ? "Convert to invoice" : "Open the quote";
  const note = "You're getting this because you sent this quote from BillSafi.";
  return {
    to,
    subject,
    html: emailLayout({ preview: subject, title: subject, name, paragraphs, action, url, note }),
    text: [`Hi ${name},`, ...paragraphs, `${action}: ${url}`, note].join("\n\n"),
  };
}

/** "1 month", "2 months". */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export type GiftEmail =
  | { kind: "pro_months"; quantity: number; until: Date }
  | { kind: "invoice_credits"; quantity: number };

/** Tells an account about a gift from BillSafi. Never names the admin or their reason (D072). */
export function giftEmail(
  to: string,
  name: string,
  gift: GiftEmail,
  billingUrl: string,
): MailMessage {
  const what =
    gift.kind === "pro_months"
      ? plural(gift.quantity, "month") + " of Pro"
      : plural(gift.quantity, "invoice credit");
  const detail =
    gift.kind === "pro_months"
      ? `You now have Pro until ${dayOnly.format(gift.until)}.`
      : "Credits are used after your monthly allowance and don't expire.";
  const paragraphs = [`BillSafi has given you ${what}, free of charge.`, detail];
  const note = "There's nothing to pay. This gift shows as No charge in your billing history.";
  return {
    to,
    subject: `You've got ${what} on BillSafi`,
    html: emailLayout({
      preview: `${what}, free of charge.`,
      title: "A gift from BillSafi",
      name,
      paragraphs,
      action: "View billing",
      url: billingUrl,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `View billing: ${billingUrl}`, note].join("\n\n"),
  };
}

/** What a past gift still gives the account, for the one-off email (D078). */
export interface PastGifts {
  pro?: { months: number; until: Date };
  credits?: { given: number; left: number };
}

/** One email per account about gifts given before gift emails existed. */
export function pastGiftsEmail(
  to: string,
  name: string,
  gifts: PastGifts,
  billingUrl: string,
): MailMessage {
  const lines = [
    gifts.pro &&
      `${plural(gifts.pro.months, "month")} of Pro. You have Pro until ${dayOnly.format(gifts.pro.until)}.`,
    gifts.credits &&
      `${plural(gifts.credits.given, "invoice credit")}. You have ${gifts.credits.left} left, and they don't expire.`,
  ].filter((line): line is string => Boolean(line));
  const paragraphs = ["BillSafi added this to your account, free of charge:", ...lines];
  const note = "There's nothing to pay. You'll find it as No charge in your billing history.";
  return {
    to,
    subject: "A gift from BillSafi on your account",
    html: emailLayout({
      preview: "A free extra on your BillSafi account.",
      title: "A gift from BillSafi",
      name,
      paragraphs,
      action: "View billing",
      url: billingUrl,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `View billing: ${billingUrl}`, note].join("\n\n"),
  };
}
