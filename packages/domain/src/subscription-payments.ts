/** A plan payment still pending after this long is treated as stuck (admin dashboard). */
export const STUCK_PAYMENT_AFTER_MS = 10 * 60 * 1000;

/** Pending payments created before this instant count as stuck. */
export function stuckPaymentCutoff(at: Date = new Date()): Date {
  return new Date(at.getTime() - STUCK_PAYMENT_AFTER_MS);
}
