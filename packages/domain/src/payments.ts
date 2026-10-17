import { money, toMoneyString } from "./money.js";

/** Kenya observes East Africa Time all year (UTC+3). */
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export type PaymentStatus = "ready" | "partially_paid" | "paid";

/** Status of an issued, uncancelled invoice from its effective payments (D008, D043). */
export function paymentStatus(total: string, paymentsReceived: string): PaymentStatus {
  const paid = money(paymentsReceived);
  if (paid.isZero()) return "ready";
  return paid.greaterThanOrEqualTo(total) ? "paid" : "partially_paid";
}

export function balanceDue(total: string, paymentsReceived: string): string {
  return toMoneyString(money(total).minus(paymentsReceived));
}

/** Sum of effective payment amounts: reversed payments are excluded by the caller. */
export function sumPayments(amounts: string[]): string {
  return toMoneyString(amounts.reduce((sum, amount) => sum.plus(amount), money(0)));
}

/** The calendar date in Nairobi at `at`, as YYYY-MM-DD. */
export function nairobiDate(at: Date): string {
  return new Date(at.getTime() + NAIROBI_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Overdue from 00:00 Nairobi on the day after the due date, for Ready and
 * Partially paid invoices only (D049).
 */
export function isOverdue(status: string, dueDate: string, at: Date = new Date()): boolean {
  if (status !== "ready" && status !== "partially_paid") return false;
  return nairobiDate(at) > dueDate;
}
