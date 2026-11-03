import type { ReengagementSegment, ReengagementStep } from "@billsafi/domain";
import type { MailMessage } from "../mail/mailer.js";
import { emailLayout } from "../mail/templates.js";

export interface ReengagementEmailInput {
  to: string;
  name: string;
  segment: ReengagementSegment;
  step: ReengagementStep;
  /** Where the button points, with tracking parameters already added. */
  url: string;
  unsubscribeUrl: string;
  /** One-click unsubscribe endpoint for the List-Unsubscribe header. */
  oneClickUrl: string;
  replyTo: string;
  signature: string;
}

interface Copy {
  subject: string;
  preview: string;
  title: string;
  paragraphs: string[];
  action: string;
  note: string;
}

/** Steps 1 and 2 are short, branded emails with one button. */
const BRANDED: Record<ReengagementSegment, Record<1 | 2, Copy>> = {
  no_business: {
    1: {
      subject: "Your BillSafi account is ready when you are",
      preview: "Add your business and send your first invoice.",
      title: "Set up your business in two minutes",
      paragraphs: [
        "You signed up for BillSafi but haven't added your business yet.",
        "Add your business name and phone number, and you can send your first invoice straight after.",
      ],
      action: "Set up your business",
      note: "Only you can see the details you add.",
    },
    2: {
      subject: "Send your first invoice today",
      preview: "Most people send their first invoice in under five minutes.",
      title: "Your first invoice takes five minutes",
      paragraphs: [
        "Add your business, pick a client, list the work, and BillSafi works out the totals.",
        "Share the invoice as a PDF or a link on WhatsApp. The Free plan covers 10 invoices a month.",
      ],
      action: "Get started",
      note: "No card or M-Pesa payment needed for the Free plan.",
    },
  },
  no_invoice: {
    1: {
      subject: "Your first invoice is a few clicks away",
      preview: "Your business is set up. Send your first invoice.",
      title: "Your business is ready to invoice",
      paragraphs: [
        "Your business is set up on BillSafi. The next step is your first invoice.",
        "Pick a client, add the work and the amount, and BillSafi does the maths. Download a PDF or share a link on WhatsApp.",
      ],
      action: "Create an invoice",
      note: "Your business details are saved, so you won't have to type them again.",
    },
    2: {
      subject: "Get paid with less back and forth",
      preview: "Your M-Pesa or bank details go on every invoice.",
      title: "Make it easy for clients to pay you",
      paragraphs: [
        "Every BillSafi invoice shows your M-Pesa or bank details, so clients know exactly how to pay.",
        "When the money arrives, record the payment and the invoice shows as paid. Your dashboard keeps track of what's still owed.",
      ],
      action: "Create an invoice",
      note: "The Free plan covers 10 invoices a month.",
    },
  },
  lapsed: {
    1: {
      subject: "Your invoices are still here",
      preview: "Your clients and invoices are where you left them.",
      title: "Pick up where you left off",
      paragraphs: [
        "It's been a while since you used BillSafi. Your businesses, clients and invoices are where you left them.",
        "Your clients are saved, so the next invoice takes about a minute.",
      ],
      action: "Open BillSafi",
      note: "Nothing has been deleted from your account.",
    },
    2: {
      subject: "Check who still owes you",
      preview: "See which invoices are paid and which are overdue.",
      title: "See what's still unpaid",
      paragraphs: [
        "Your BillSafi dashboard shows which invoices are paid and which are overdue.",
        "If a client hasn't paid, open the invoice and share it again on WhatsApp or email.",
      ],
      action: "See your invoices",
      note: "Recording a payment marks the invoice as paid.",
    },
  },
};

/** Step 3 is a plain-text note that asks for a reply, like a person would write. */
const PERSONAL: Record<ReengagementSegment, { subject: string; opening: string }> = {
  no_business: {
    subject: "Did something get in the way?",
    opening:
      "You created a BillSafi account a while back but didn't get as far as adding your business. I'd like to know why. Was something confusing, missing, or was it just not the right time?",
  },
  no_invoice: {
    subject: "Did something stop your first invoice?",
    opening:
      "You set up your business on BillSafi but haven't sent an invoice yet. Was something confusing or missing? Or did you not need one yet?",
  },
  lapsed: {
    subject: "Quick question about BillSafi",
    opening:
      "You used BillSafi for invoices for a while, then stopped. If something didn't work for you, I'd like to hear about it.",
  },
};

export function reengagementEmail(input: ReengagementEmailInput): MailMessage {
  const headers = {
    "List-Unsubscribe": `<${input.oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  const footer = `Don't want these emails? Unsubscribe: ${input.unsubscribeUrl}`;

  if (input.step === 3) {
    const personal = PERSONAL[input.segment];
    return {
      to: input.to,
      subject: personal.subject,
      replyTo: input.replyTo,
      headers,
      text: [
        `Hi ${input.name},`,
        personal.opening,
        "Just reply to this email and tell me. I read every reply.",
        `If you'd like to give it another go, start here: ${input.url}`,
        input.signature,
        "---",
        footer,
      ].join("\n\n"),
    };
  }

  const copy = BRANDED[input.segment][input.step];
  return {
    to: input.to,
    subject: copy.subject,
    replyTo: input.replyTo,
    headers,
    html: emailLayout({
      preview: copy.preview,
      title: copy.title,
      name: input.name,
      paragraphs: copy.paragraphs,
      action: copy.action,
      url: input.url,
      note: copy.note,
      unsubscribeUrl: input.unsubscribeUrl,
    }),
    text: [
      `Hi ${input.name},`,
      ...copy.paragraphs,
      `${copy.action}: ${input.url}`,
      copy.note,
      "---",
      footer,
    ].join("\n\n"),
  };
}
