import type { AdminPlanPayment, ManualPaymentCurrency } from "@billsafi/contracts";
import { schema, sql } from "@billsafi/db";
import { effectiveWindowEnd, maskPhone, nairobiDate } from "@billsafi/domain";

const { subscriptionPayments, users } = schema;

/**
 * Columns for an admin plan payment row: select them from subscription_payments joined to
 * users (the account), then map with toAdminPlanPayment.
 */
export const planPaymentColumns = {
  payment: subscriptionPayments,
  userEmail: users.email,
  recorderEmail: sql<
    string | null
  >`(select r.email from users r where r.id = ${subscriptionPayments.recordedBy})`,
};

export interface PlanPaymentRow {
  payment: typeof subscriptionPayments.$inferSelect;
  userEmail: string;
  recorderEmail: string | null;
}

export function toAdminPlanPayment({
  payment,
  userEmail,
  recorderEmail,
}: PlanPaymentRow): AdminPlanPayment {
  const manual = payment.provider === schema.MANUAL_PROVIDER;
  const window = payment.grantedUntil
    ? effectiveWindowEnd(payment.grantedUntil, payment.endedEarlyAt)
    : null;
  return {
    id: payment.id,
    createdAt: payment.createdAt.toISOString(),
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    userId: payment.userId,
    userEmail,
    purpose: payment.purpose,
    quantity: payment.quantity,
    amount: payment.amount,
    currency: payment.currency as ManualPaymentCurrency,
    priceUsd: payment.priceUsd,
    status: payment.status,
    provider: manual ? "manual" : "mpesa",
    method: payment.method,
    phone: payment.phone ? maskPhone(payment.phone) : null,
    receipt: payment.receipt,
    externalReference: payment.externalReference,
    paidOn: payment.paidAt ? nairobiDate(payment.paidAt) : null,
    recordedBy: payment.recordedBy ? { id: payment.recordedBy, email: recorderEmail } : null,
    note: payment.note,
    resultDescription: payment.status === "failed" ? payment.resultDescription : null,
    grantedFrom: payment.grantedFrom?.toISOString() ?? null,
    grantedUntil: window?.end.toISOString() ?? null,
    endedEarly: window?.endedEarly ?? false,
    creditsGranted: payment.creditsGranted,
  };
}
