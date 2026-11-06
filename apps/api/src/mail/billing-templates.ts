import { dayOnly, emailLayout, plural } from "./templates.js";
import type { MailMessage } from "./mailer.js";

/** What a settled M-Pesa payment bought. */
export type PaymentPurchase =
  { kind: "pro_month"; until: Date } | { kind: "invoice_credits"; credits: number };

export interface PaymentReceipt {
  purchase: PaymentPurchase;
  amount: string;
  currency: string;
  /** The M-Pesa receipt code, when Daraja sent one. */
  receipt: string | null;
}

/** Confirms an M-Pesa payment that went through. */
export function paymentReceiptEmail(
  to: string,
  name: string,
  receipt: PaymentReceipt,
  billingUrl: string,
): MailMessage {
  const { purchase } = receipt;
  const bought =
    purchase.kind === "pro_month" ? "1 month of Pro" : plural(purchase.credits, "invoice credit");
  const paragraphs = [
    `We got your payment of ${receipt.currency} ${receipt.amount} for ${bought}. Thank you.`,
    purchase.kind === "pro_month"
      ? `You now have Pro until ${dayOnly.format(purchase.until)}.`
      : `${plural(purchase.credits, "credit")} added. Credits are used after your monthly allowance and don't expire.`,
  ];
  if (receipt.receipt) paragraphs.push(`M-Pesa receipt: ${receipt.receipt}`);
  const note =
    "BillSafi never takes payment automatically. This payment is also in your billing history.";
  return {
    to,
    subject: `Payment received: ${bought}`,
    html: emailLayout({
      preview: `${receipt.currency} ${receipt.amount} received for ${bought}.`,
      title: "Payment received",
      name,
      paragraphs,
      action: "View billing",
      url: billingUrl,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `View billing: ${billingUrl}`, note].join("\n\n"),
  };
}

/** Tells an account that an M-Pesa payment did not go through. */
export function paymentFailedEmail(to: string, name: string, billingUrl: string): MailMessage {
  const paragraphs = [
    "Your M-Pesa payment to BillSafi didn't go through, and you haven't been charged.",
    "You can try again from the Billing page whenever you're ready.",
  ];
  const note = "Nothing changes on your account until a payment goes through.";
  return {
    to,
    subject: "Your BillSafi payment didn't go through",
    html: emailLayout({
      preview: "Nothing was charged. You can try again from Billing.",
      title: "Payment didn't go through",
      name,
      paragraphs,
      action: "Try again",
      url: billingUrl,
      note,
    }),
    text: [`Hi ${name},`, ...paragraphs, `Try again: ${billingUrl}`, note].join("\n\n"),
  };
}
