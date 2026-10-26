import type { AdminSupportDiagnostics } from "@billsafi/contracts";
import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { formatDay, formatRelative } from "../admin-format";
import { subscriptionsHref, tenantHref } from "../admin-params";
import { PaymentStatusPill } from "../admin-ui";
import { actionLabel } from "../audit/audit-labels";
import { StatusBadge } from "../status-badge";
import { planText } from "../tenants/tenant-text";

const link =
  "inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0";

/** Read-only facts about the case's account, with links into the tenant page. */
export function CaseDiagnostics({
  accountId,
  diagnostics,
}: {
  accountId: string;
  diagnostics: AdminSupportDiagnostics;
}) {
  const { subscription, lastPayment, stuckPayments, recentActions } = diagnostics;
  return (
    <div className="divide-y divide-line">
      <div className="space-y-1.5 p-4">
        <p className="text-xs text-sub">Plan</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="subscription" value={subscription.status} />
          <span className="text-sm">{planText(subscription.plan)}</span>
        </div>
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-xs text-sub">Last payment</p>
        {lastPayment ? (
          <>
            <p className="text-sm">
              {formatMoney(lastPayment.amount, lastPayment.currency)} on{" "}
              {formatDay(lastPayment.createdAt)}
            </p>
            <PaymentStatusPill status={lastPayment.status} />
          </>
        ) : (
          <p className="text-sm text-sub">No payments</p>
        )}
        {stuckPayments > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-200">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {stuckPayments} stuck {stuckPayments === 1 ? "payment" : "payments"}
          </p>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-xs text-sub">Recent admin actions</p>
        {recentActions.length === 0 ? (
          <p className="text-sm text-sub">None</p>
        ) : (
          <ul className="space-y-1">
            {recentActions.map((entry) => (
              <li key={entry.id} className="text-sm">
                {actionLabel(entry.action)}
                <span className="text-xs text-sub"> · {formatRelative(entry.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col p-4">
        <Link href={tenantHref(accountId)} className={link}>
          Open the account
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link href={tenantHref(accountId, "subscription")} className={link}>
          Subscription
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link href={subscriptionsHref("payments", { search: accountId })} className={link}>
          Payments
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link href={tenantHref(accountId, "activity")} className={link}>
          Activity and audit
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  );
}
