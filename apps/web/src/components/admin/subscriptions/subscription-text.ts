import type {
  AccountGrantKind,
  ManualPaymentMethod,
  SubscriptionPurpose,
} from "@billsafi/contracts";
import { CREDIT_PACK } from "@billsafi/domain";
import { formatCount } from "../admin-format";

/* Plain-English labels for plan payments, grants and overrides. */

export const methodLabels: Record<ManualPaymentMethod, string> = {
  mpesa_direct: "M-Pesa sent directly",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** What a payment bought, like "Pro, 3 months" or "2 credit packs (100 invoices)". */
export function paymentForText(purpose: SubscriptionPurpose, quantity: number): string {
  if (purpose === "pro_month") return `Pro, ${plural(quantity, "month", "months")}`;
  return `${plural(quantity, "credit pack", "credit packs")} (${formatCount(quantity * CREDIT_PACK.invoices)} invoices)`;
}

/** What a gift gave, like "3 Pro months" or "50 invoice credits". */
export function grantText(kind: AccountGrantKind, quantity: number): string {
  return kind === "pro_months"
    ? plural(quantity, "Pro month", "Pro months")
    : plural(quantity, "invoice credit", "invoice credits");
}

/** Who recorded or granted something: their email, or a removed admin. */
export function adminText(admin: { email: string | null } | null): string {
  if (!admin) return "Unknown";
  return admin.email ?? "Removed admin";
}
