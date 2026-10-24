import { type AdminUserDetail, invoiceStatusLabels, invoiceStatuses } from "@billsafi/contracts";
import { ArrowLeft } from "lucide-react";
import { formatCount, formatDay, formatInstant, formatKes, purposeLabels } from "./admin-format";
import { AdminLink } from "./admin-link";
import { type AdminState, adminHref } from "./admin-params";
import { EmptyRow, Panel, PaymentStatusPill, tdClass, thClass, theadClass } from "./admin-ui";
import { lastActiveText, methodLabels, planText } from "./users-tab";

export function UserDetail({ data, state }: { data: AdminUserDetail; state: AdminState }) {
  const { user, businesses, payments } = data;
  const facts = [
    ["Sign-in", methodLabels[user.signInMethod]],
    ["Plan", planText(user.plan)],
    ["Signed up", formatDay(user.signedUpAt)],
    ["Last active", lastActiveText(user.lastActiveAt)],
    ["Ready invoices", formatCount(user.invoicesReady)],
  ];

  return (
    <div className="space-y-4">
      <AdminLink
        href={adminHref(state, { user: undefined })}
        className="text-sm text-sub hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All users
      </AdminLink>

      <section className="rounded-panel border border-line bg-panel p-4 sm:p-5">
        <h2 className="text-lg font-semibold break-words">{user.name}</h2>
        <p className="text-sm break-all text-sub">{user.email}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-sub">{label}</dt>
              <dd className="mt-0.5 text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Panel title="Businesses" description="Invoice counts by status.">
        {businesses.length === 0 ? (
          <EmptyRow text="No businesses yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={thClass}>
                  Business
                </th>
                <th scope="col" className={thClass}>
                  Created
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Clients
                </th>
                {invoiceStatuses.map((status) => (
                  <th key={status} scope="col" className={`${thClass} text-right`}>
                    {invoiceStatusLabels[status]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <tr key={business.id} className="border-t border-line">
                  <td className={`${tdClass} font-medium`}>{business.name}</td>
                  <td className={`${tdClass} text-sub`}>{formatDay(business.createdAt)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatCount(business.clients)}
                  </td>
                  {invoiceStatuses.map((status) => (
                    <td key={status} className={`${tdClass} text-right tabular-nums`}>
                      {formatCount(business.invoices[status] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Plan payments">
        {payments.length === 0 ? (
          <EmptyRow text="No plan payments." />
        ) : (
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={thClass}>
                  Started
                </th>
                <th scope="col" className={thClass}>
                  For
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Amount
                </th>
                <th scope="col" className={thClass}>
                  Status
                </th>
                <th scope="col" className={thClass}>
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-line">
                  <td className={`${tdClass} text-sub`}>{formatInstant(payment.createdAt)}</td>
                  <td className={tdClass}>{purposeLabels[payment.purpose]}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatKes(payment.amountKes)}
                  </td>
                  <td className={tdClass}>
                    <PaymentStatusPill status={payment.status} />
                  </td>
                  <td className={`${tdClass} text-sub`}>{payment.receipt ?? "No data"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
