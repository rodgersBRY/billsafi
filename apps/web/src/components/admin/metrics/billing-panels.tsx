import type { AdminBilling } from "@billsafi/contracts";
import { formatInstant, formatMonth } from "../admin-format";
import { AdminLink } from "../admin-link";
import { tenantHref } from "../admin-params";
import { EmptyRow, Panel, UpdatedAt } from "../admin-ui";
import { PaymentsTable } from "../subscriptions/payments-table";
import { tdNowrapClass, thClass, theadClass } from "../table-classes";

function UserLink({ id, email }: { id: string; email: string }) {
  return (
    <AdminLink href={tenantHref(id)} className="hover:text-accent hover:underline">
      {email}
    </AdminLink>
  );
}

/** Checkouts that need a look and Free accounts at their limit, below the payments list. */
export function BillingPanels({
  data,
  thisMonthOnly = false,
  clearLimitFilterHref,
}: {
  data: AdminBilling;
  /** Free limit hits are limited to this month. */
  thisMonthOnly?: boolean;
  clearLimitFilterHref?: string;
}) {
  return (
    <div className="space-y-4">
      <Panel
        id="stuck-payments"
        title="Stuck payments"
        description="Checkouts still pending more than 10 minutes after they started, oldest first."
      >
        {data.stuckPayments.length === 0 ? (
          <EmptyRow text="No stuck payments." />
        ) : (
          <PaymentsTable payments={data.stuckPayments} />
        )}
      </Panel>

      <Panel
        id="free-limit-hits"
        title="Free limit hits"
        description="Free months where the user reached the invoice limit in the last 90 days. Paid means a plan payment between the hit and 30 days after that month ended."
        actions={
          thisMonthOnly ? (
            <p className="flex items-center gap-2 text-sm text-sub">
              This month only
              {clearLimitFilterHref && (
                <AdminLink
                  href={clearLimitFilterHref}
                  replace
                  className="text-accent hover:underline"
                >
                  Clear filter
                </AdminLink>
              )}
            </p>
          ) : undefined
        }
      >
        {data.freeLimitHits.length === 0 ? (
          <EmptyRow
            text={
              thisMonthOnly
                ? "No one has reached the Free limit this month."
                : "No one has reached the Free limit in the last 90 days."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={thClass}>
                  User
                </th>
                <th scope="col" className={thClass}>
                  Month
                </th>
                <th scope="col" className={thClass}>
                  Reached limit
                </th>
                <th scope="col" className={thClass}>
                  Paid within 30 days
                </th>
              </tr>
            </thead>
            <tbody>
              {data.freeLimitHits.map((hit) => (
                <tr key={`${hit.userId}:${hit.month}`} className="border-t border-line">
                  <td className={tdNowrapClass}>
                    <UserLink id={hit.userId} email={hit.userEmail} />
                  </td>
                  <td className={tdNowrapClass}>{formatMonth(hit.month)}</td>
                  <td className={`${tdNowrapClass} text-sub`}>
                    {formatInstant(hit.hitAt)}
                    <span className="block text-xs">
                      Limit of {hit.limit} invoices
                      {hit.extraInvoices > 0 && `, ${hit.extraInvoices} of them from overrides`}
                    </span>
                  </td>
                  <td className={tdNowrapClass}>{hit.paidWithin30Days ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <UpdatedAt iso={data.generatedAt} />
    </div>
  );
}
