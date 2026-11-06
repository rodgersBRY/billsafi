import type { ManualPaymentCurrency, ManualPaymentMethod } from "@billsafi/contracts";
import type { MailMessage } from "./mailer.js";
import { dayOnly, emailLayout, longDate, plural } from "./templates.js";

/** None of these emails show the admin, their note or their reason (D062, D074). */
function build(
  to: string,
  name: string,
  mail: {
    subject: string;
    title: string;
    paragraphs: string[];
    note: string;
    preview: string;
  },
  billingUrl: string,
): MailMessage {
  return {
    to,
    subject: mail.subject,
    html: emailLayout({
      preview: mail.preview,
      title: mail.title,
      name,
      paragraphs: mail.paragraphs,
      action: "View billing",
      url: billingUrl,
      note: mail.note,
    }),
    text: [`Hi ${name},`, ...mail.paragraphs, `View billing: ${billingUrl}`, mail.note].join(
      "\n\n",
    ),
  };
}

const METHOD_WORDS: Record<ManualPaymentMethod, string> = {
  mpesa_direct: "M-Pesa",
  bank_transfer: "bank transfer",
  cash: "cash",
  other: "",
};

export type PaymentReceiptEmail = {
  amount: string;
  currency: ManualPaymentCurrency;
  method: ManualPaymentMethod;
  reference: string;
} & (
  | { purpose: "pro_month"; months: number; until: Date }
  | { purpose: "invoice_credits"; packs: number; credits: number }
);

/** Receipt for a payment an admin recorded by hand. */
export function paymentReceiptEmail(
  to: string,
  name: string,
  payment: PaymentReceiptEmail,
  billingUrl: string,
): MailMessage {
  const paid = `${payment.currency} ${payment.amount}`;
  const how = METHOD_WORDS[payment.method];
  const via = how ? `${how}, reference ${payment.reference}` : `reference ${payment.reference}`;
  const bought =
    payment.purpose === "pro_month"
      ? `It covers ${plural(payment.months, "month")} of Pro. You now have Pro until ${dayOnly.format(payment.until)}.`
      : `It adds ${plural(payment.credits, "invoice credit")} (${plural(payment.packs, "pack")}). Credits are used after your monthly allowance and don't expire.`;
  return build(
    to,
    name,
    {
      subject: `We've recorded your payment of ${paid}`,
      title: "Payment received",
      preview: `Your payment of ${paid} is recorded.`,
      paragraphs: [`We've recorded your payment of ${paid} (${via}).`, bought],
      note: "Keep this email as your receipt. Your billing history has the full record.",
    },
    billingUrl,
  );
}

/** Pro was cut back to the end of the current Pro month. */
export function proEndedEmail(
  to: string,
  name: string,
  until: Date,
  billingUrl: string,
): MailMessage {
  const day = dayOnly.format(until);
  return build(
    to,
    name,
    {
      subject: `Your BillSafi Pro plan ends on ${day}`,
      title: "Your Pro plan is ending",
      preview: `Pro ends on ${day}, then you're on Free.`,
      paragraphs: [
        `Your Pro plan will end on ${day}. Until then, nothing changes.`,
        "After that you'll be on the Free plan. Your businesses, invoices and payments all stay.",
        "You can renew Pro any time from your billing page.",
      ],
      note: "Nothing is deleted when Pro ends.",
    },
    billingUrl,
  );
}

export interface OverrideEmail {
  extraInvoices: number;
  startsAt: Date;
  expiresAt: Date;
  /** True when it starts later, so the email says "from" as well as "until". */
  scheduled: boolean;
}

/** Tells an account its invoice limit was raised for a while. */
export function overrideAddedEmail(
  to: string,
  name: string,
  override: OverrideEmail,
  billingUrl: string,
): MailMessage {
  const extra = plural(override.extraInvoices, "extra invoice");
  const until = longDate.format(override.expiresAt);
  const when = override.scheduled
    ? `from ${longDate.format(override.startsAt)} until ${until}`
    : `until ${until}`;
  return build(
    to,
    name,
    {
      subject: `You can issue ${extra} on BillSafi`,
      title: "Your invoice limit is higher",
      preview: `${extra}, ${when}.`,
      paragraphs: [
        `You can issue ${extra} on top of your plan's monthly limit, ${when}.`,
        "The extra invoices count only while this is active.",
      ],
      note: "Your plan and price don't change.",
    },
    billingUrl,
  );
}

/** Tells an account its extra invoices were ended early. */
export function overrideRevokedEmail(to: string, name: string, billingUrl: string): MailMessage {
  return build(
    to,
    name,
    {
      subject: "Your extra invoices on BillSafi have ended",
      title: "Your extra invoices have ended",
      preview: "Your invoice limit is back to your plan's.",
      paragraphs: [
        "Your extra invoices on BillSafi have ended.",
        "Your invoice limit is back to what your plan includes. Invoices you already issued stay as they are.",
      ],
      note: "Your billing page shows your plan and what's left this month.",
    },
    billingUrl,
  );
}
