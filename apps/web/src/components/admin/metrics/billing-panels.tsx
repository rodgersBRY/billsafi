import type { AdminBilling, AdminBillingPayment } from "@billsafi/contracts";
import { formatAmount } from "@/lib/format";
import { formatInstant, formatMonth, purposeLabels } from "../admin-format";
import { AdminLink } from "../admin-link";
import { tenantHref } from "../admin-params";
import { EmptyRow, Panel, PaymentStatusPill, UpdatedAt } from "../admin-ui";
import { tdNowrapClass, thClass, theadClass } from "../table-classes";

function UserLink({ id, email }: { id: string; email: string }) {
  return (
    <AdminLink href={tenantHref(id)} className="hover:text-accent hover:underline">
      {email}
    </AdminLink>
  );
}

function PaymentsTable({ payments }: { payments: AdminBillingPayment[] }) {
  return (
    <table className="w-full text-sm">
      <thead className={theadClass}>
        <tr>
          <th scope="col" className={thClass}>
            Started
          </th>
          <th scope="col" className={thClass}>
            User
          </th>
          <th scope="col" className={thClass}>
            For
          </th>
          <th scope="col" className={`${thClass} text-right`}>
            KES
          </th>
          <th scope="col" className={`${thClass} text-right`}>
            USD
          </th>
          <th scope="col" className={thClass}>
            Status
          </th>
          <th scope="col" className={thClass}>
            Phone
          </th>
          <th scope="col" className={thClass}>
            Receipt or reason
          </th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.id} className="border-t border-line">
            <td className={`${tdNowrapClass} text-sub`}>{formatInstant(payment.createdAt)}</td>
            <td className={tdNowrapClass}>
              <UserLink id={payment.userId} email={payment.userEmail} />
            </td>
            <td className={tdNowrapClass}>{purposeLabels[payment.purpose]}</td>
            <td className={`${tdNowrapClass} text-right tabular-nums`}>
              {formatAmount(payment.amountKes)}
            </td>
            <td className={`${tdNowrapClass} text-right tabular-nums`}>
              {payment.priceUsd === null ? (
                <span className="text-sub">No data</span>
              ) : (
                formatAmount(payment.priceUsd)
              )}
            </td>
            <td className={tdNowrapClass}>
              <PaymentStatusPill status={payment.status} />
            </td>
            <td className={`${tdNowrapClass} text-sub tabular-nums`}>{payment.phone}</td>
            <td className={`${tdNowrapClass} text-sub`}>
              {(payment.status === "failed" ? payment.resultDescription : payment.receipt) ??
                "No data"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BillingPanels({ data }: { data: AdminBilling }) {
  return (
    <div className="space-y-4">
      <Panel title="Recent payments" description="The 50 latest plan payments, newest first.">
        {data.recentPayments.length === 0 ? (
          <EmptyRow text="No plan payments yet." />
        ) : (
          <PaymentsTable payments={data.recentPayments} />
        )}
      </Panel>

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
        title="Free limit hits"
        description="Free months where the user reached the invoice limit in the last 90 days. Paid means a plan payment between the hit and 30 days after that month ended."
      >
        {data.freeLimitHits.length === 0 ? (
          <EmptyRow text="No one has reached the Free limit in the last 90 days." />
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
                    <span className="block text-xs">Limit of {hit.limit} invoices</span>
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
