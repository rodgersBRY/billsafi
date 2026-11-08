import { money, type MoneyInput } from "./money.js";

/** Free: 10 invoices per Nairobi calendar month across all businesses (D019, D044). */
export const FREE_PLAN = { code: "free", invoiceLimit: 10, savedItemLimit: 5 } as const;

/** Pro: USD 4 per anniversary month, 100 invoices per month (D020, D044). */
export const PRO_PLAN = { code: "pro", invoiceLimit: 100, priceUsd: "4.00" } as const;

/** Extra invoices used after the plan allowance; they do not expire (D051). */
export const CREDIT_PACK = { invoices: 50, priceUsd: "2.00" } as const;

/** Renewal reminders start this many days before paid access ends (D051). */
export const REMINDER_DAYS_BEFORE = 3;

/** Currencies plan prices can be shown in. M-Pesa always charges KES. */
export const priceCurrencies = ["USD", "KES"] as const;
export type PriceCurrency = (typeof priceCurrencies)[number];

/**
 * The whole-shilling M-Pesa charge for a USD price. Rounds up so the KES
 * amount never falls below the USD price, since M-Pesa takes no cents.
 */
export function usdToKes(priceUsd: MoneyInput, usdKesRate: MoneyInput): string {
  return money(priceUsd).times(usdKesRate).ceil().toFixed(2);
}

/**
 * Free accounts keep up to 5 active saved items across all businesses; Pro has no cap (D080).
 * Items above the cap after Pro ends stay usable; only new ones are blocked.
 */
export function canAddSavedItem(isPro: boolean, activeCount: number): boolean {
  return isPro || activeCount < FREE_PLAN.savedItemLimit;
}

/**
 * Saved items that newly appear on a document. Lines already linked before the save
 * don't count again, so re-saving a draft doesn't inflate usage (D080).
 */
export function newlyUsedSavedItems(
  before: (string | null | undefined)[],
  after: (string | null | undefined)[],
): string[] {
  const previous = new Set(before.filter(Boolean));
  return [...new Set(after.filter((id): id is string => Boolean(id) && !previous.has(id!)))];
}
