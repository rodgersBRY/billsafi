import { toMoneyString } from "./money.js";
import { nairobiDate } from "./payments.js";

export const quoteStatuses = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "withdrawn",
  "converted",
] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

/** The stored status, or Expired for a Sent quote past its valid-until day. */
export type QuoteDisplayStatus = QuoteStatus | "expired";

/** Default validity for a new quote, in days from its issue date. */
export const QUOTE_VALIDITY_DAYS = 14;

/** Expired from 00:00 Nairobi on the day after `validUntil`. Only Sent quotes expire. */
export function isQuoteExpired(status: QuoteStatus, validUntil: string, at = new Date()): boolean {
  return status === "sent" && nairobiDate(at) > validUntil;
}

export function quoteDisplayStatus(
  status: QuoteStatus,
  validUntil: string,
  at = new Date(),
): QuoteDisplayStatus {
  return isQuoteExpired(status, validUntil, at) ? "expired" : status;
}

export type QuoteAction = "edit" | "send" | "share" | "withdraw" | "delete" | "respond" | "convert";

const ALLOWED: Record<QuoteAction, readonly QuoteDisplayStatus[]> = {
  edit: ["draft", "sent", "declined", "expired"],
  send: ["draft", "declined", "expired"],
  share: ["sent"],
  withdraw: ["sent", "declined", "expired"],
  delete: ["draft"],
  respond: ["sent"],
  // Sent needs the freelancer to confirm a verbal yes; the API checks that flag.
  convert: ["accepted", "sent"],
};

export function quoteAllows(action: QuoteAction, status: QuoteDisplayStatus): boolean {
  return ALLOWED[action].includes(status);
}

/** What the client agrees to. A change here on a sent quote saves a new version. */
export interface QuoteContent {
  currency: string;
  validUntil: string;
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  notes: string | null;
  items: { description: string; quantity: string; unitPrice: string }[];
}

function normalize(content: QuoteContent): string {
  return JSON.stringify({
    currency: content.currency,
    validUntil: content.validUntil,
    discount: content.discount
      ? { type: content.discount.type, value: toMoneyString(content.discount.value) }
      : null,
    taxRate: content.taxRate === null ? null : toMoneyString(content.taxRate),
    notes: content.notes ?? null,
    items: content.items.map((item) => ({
      description: item.description,
      quantity: toMoneyString(item.quantity),
      unitPrice: toMoneyString(item.unitPrice),
    })),
  });
}

export function quoteContentChanged(previous: QuoteContent, next: QuoteContent): boolean {
  return normalize(previous) !== normalize(next);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `date` (YYYY-MM-DD) plus `days` calendar days. */
export function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
