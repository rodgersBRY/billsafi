import type { AdminPlanPayment } from "@billsafi/contracts";
import { Scissors } from "lucide-react";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { formatCount, formatDay, formatInstant } from "../admin-format";
import { PaymentStatusPill } from "../admin-ui";
import { tenantHref } from "../admin-params";
import { type Column, DataTable, tdClass, tdNowrapClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { adminText, methodLabels, paymentForText } from "./subscription-text";

const columns: Column[] = [
  { label: "Date" },
  { label: "Account" },
  { label: "For" },
  { label: "Amount", align: "right" },
  { label: "Status" },
  { label: "Source" },
  { label: "Reference" },
  { label: "Recorded by and note" },
  { label: "Access added" },
];

/** Marks a Pro window an admin cut short, in text as well as the icon. */
export function EndedEarly() {
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-800 dark:text-amber-200">
      <Scissors aria-hidden className="size-3.5" />
      Ended early by an admin
    </span>
  );
}

function referenceText(payment: AdminPlanPayment): string {
  if (payment.status === "failed") return payment.resultDescription ?? "Failed";
  return payment.receipt ?? payment.externalReference ?? "None";
}

function AccessAdded({ payment }: { payment: AdminPlanPayment }) {
  if (payment.status !== "succeeded") return <span className="text-sub">Nothing</span>;
  if (payment.purpose === "invoice_credits") {
    return <>{formatCount(payment.creditsGranted)} credits</>;
  }
  if (!payment.grantedUntil) return <span className="text-sub">Not recorded</span>;
  if (payment.endedEarly && payment.grantedFrom && payment.grantedUntil <= payment.grantedFrom) {
    return (
      <>
        Dropped before it began
        <EndedEarly />
      </>
    );
  }
  return (
    <>
      Pro until {formatDay(payment.grantedUntil)}
      {payment.endedEarly && <EndedEarly />}
    </>
  );
}

/** Plan payments, M-Pesa checkouts and manual records alike, newest first. */
export function PaymentsTable({
  payments,
  showAccount = true,
}: {
  payments: AdminPlanPayment[];
  showAccount?: boolean;
}) {
  const shown = showAccount ? columns : columns.filter((column) => column.label !== "Account");
  return (
    <DataTable caption="Plan payments" columns={shown}>
      {payments.map((payment) => (
        <tr key={payment.id} className="border-t border-line">
          <td className={tdNowrapClass}>
            {formatInstant(payment.createdAt)}
            {payment.paidOn && (
              <span className="block text-xs text-sub">Paid on {formatDate(payment.paidOn)}</span>
            )}
          </td>
          {showAccount && (
            <td className={`${tdClass} max-w-64 min-w-48 break-all`}>
              <Link
                href={tenantHref(payment.userId, "subscription")}
                className="hover:text-accent hover:underline"
              >
                {payment.userEmail}
              </Link>
            </td>
          )}
          <td className={tdNowrapClass}>{paymentForText(payment.purpose, payment.quantity)}</td>
          <td className={`${tdNowrapClass} text-right tabular-nums`}>
            {formatMoney(payment.amount, payment.currency)}
          </td>
          <td className={tdClass}>
            <PaymentStatusPill status={payment.status} />
          </td>
          <td className={tdClass}>
            <StatusBadge kind="provider" value={payment.provider} />
            <span className="mt-0.5 block text-xs whitespace-nowrap text-sub">
              {payment.method ? methodLabels[payment.method] : payment.phone}
            </span>
          </td>
          <td className={`${tdClass} max-w-48 min-w-28 break-words`}>{referenceText(payment)}</td>
          <td className={`${tdClass} max-w-64 min-w-40`}>
            {payment.provider === "manual" ? (
              <>
                <span className="break-all">{adminText(payment.recordedBy)}</span>
                {payment.note && (
                  <span className="mt-0.5 block text-xs break-words text-sub">{payment.note}</span>
                )}
              </>
            ) : (
              <span className="text-sub">Checkout</span>
            )}
          </td>
          <td className={tdNowrapClass}>
            <AccessAdded payment={payment} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
