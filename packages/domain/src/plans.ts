import { money, type MoneyInput } from "./money.js";

/** Free: 10 invoices per Nairobi calendar month across all businesses (D019, D044). */
export const FREE_PLAN = { code: "free", invoiceLimit: 10 } as const;

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
