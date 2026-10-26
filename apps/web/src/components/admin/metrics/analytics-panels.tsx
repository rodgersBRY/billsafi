import type { AdminAnalytics, AdminFeatureKey } from "@billsafi/contracts";
import { BarList } from "../charts/bar-list";
import { bucketFullLabel, bucketLabel } from "../charts/chart-utils";
import { GroupedBars } from "../charts/grouped-bars";
import { formatCount, formatDuration, formatMonth, formatShare } from "../admin-format";
import { AdminLink } from "../admin-link";
import { tenantHref } from "../admin-params";
import { EmptyRow, Panel } from "../admin-ui";
import { KpiCard } from "../kpi-card";
import { tdClass, thClass, theadClass } from "../table-classes";

const featureLabels: Record<AdminFeatureKey, string> = {
  discount: "Used a discount",
  tax: "Used tax",
  logo: "Uploaded a logo",
  paymentInstructions: "Set payment instructions",
  shareLink: "Created a share link",
  paymentRecorded: "Recorded a payment",
  secondBusiness: "Added a second business",
  googleSignIn: "Signed in with Google",
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-sub">{note}</p>
      </div>
      {children}
    </section>
  );
}

export function InvoiceVolume({ data }: { data: AdminAnalytics }) {
  const { invoiceVolume: v, bucketSize } = data;
  const created = v.points.map((p) => p.created);
  const ready = v.points.map((p) => p.ready);
  const median =
    v.medianReadyPerAccount === null
      ? "No account made an invoice Ready in this range."
      : `Accounts that made any invoice Ready made a median of ${formatCount(v.medianReadyPerAccount)}.`;
  return (
    <Section id="volume-title" title="Invoice volume" note={data.definitions.invoiceVolume}>
      <GroupedBars
        title="Invoices created and made Ready"
        summary={`${formatCount(sum(created))} invoices created and ${formatCount(sum(ready))} made Ready, side by side per ${bucketSize}. ${median}`}
        labels={v.points.map((p) => bucketLabel(p.bucketStart, bucketSize))}
        fullLabels={v.points.map((p) => bucketFullLabel(p.bucketStart, bucketSize))}
        series={[
          { name: "Created", values: created },
          { name: "Made Ready", values: ready },
        ]}
        unit="count"
        emptyText="No invoices in this range."
      />
    </Section>
  );
}

export function TimeToFirstInvoice({ data }: { data: AdminAnalytics }) {
  const t = data.timeToFirstInvoice;
  const hours = (value: number | null) => (value === null ? null : formatDuration(value * 3600));
  const none =
    t.signups === 0
      ? "No sign-ups in this range."
      : "No sign-up in this range has made an invoice Ready yet.";
  return (
    <Section
      id="first-invoice-title"
      title="Time to first invoice"
      note={data.definitions.timeToFirstInvoice}
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li>
          <KpiCard
            label="Median time"
            value={hours(t.medianHours)}
            definition="Half of the accounts that got there took less than this."
            detail={
              t.medianHours === null
                ? none
                : `${formatCount(t.reached)} of ${formatCount(t.signups)} sign-ups so far.`
            }
          />
        </li>
        <li>
          <KpiCard
            label="75th percentile"
            value={hours(t.p75Hours)}
            definition="Three quarters of the accounts that got there took less than this."
            detail={t.p75Hours === null ? none : undefined}
          />
        </li>
        <li>
          <KpiCard
            label="Activation within 7 days"
            value={t.activation.rate === null ? null : formatShare(t.activation.rate)}
            definition="Sign-ups that made an invoice Ready within 7 days."
            detail={
              t.activation.rate === null
                ? "No sign-ups in this range are 7 days old yet."
                : `${formatCount(t.activation.count)} of ${formatCount(t.activation.base)} sign-ups.`
            }
          />
        </li>
      </ul>
    </Section>
  );
}

export function FeatureAdoption({ data }: { data: AdminAnalytics }) {
  const { base, items } = data.featureAdoption;
  return (
    <Section id="adoption-title" title="Feature adoption" note={data.definitions.featureAdoption}>
      <BarList
        title="Accounts that have used each feature"
        summary={`Out of ${formatCount(base)} accounts with a business, ever, not only in this range. PDF downloads and link opens need event tracking.`}
        items={items.map((item) => ({
          label: featureLabels[item.key],
          value: item.share ?? 0,
          display: `${formatShare(item.share)} (${formatCount(item.count)} of ${formatCount(item.base)})`,
        }))}
        max={1}
        valueHeading="Share of accounts"
        emptyText="No accounts with a business yet."
      />
    </Section>
  );
}

export function PlanLimit({ data }: { data: AdminAnalytics }) {
  const months = data.planLimit;
  const reached = months.map((m) => m.reached);
  const bought = months.map((m) => m.boughtWithin14Days);
  const rate = months.map((m) =>
    m.reached === 0 ? "No hits" : `${formatShare(m.boughtWithin14Days / m.reached)} bought`,
  );
  return (
    <Section id="limit-title" title="Plan limit reached" note={data.definitions.planLimit}>
      <GroupedBars
        title="Free accounts that reached their limit"
        summary={`${formatCount(sum(reached))} Free accounts used their whole allowance in the last 6 months, and ${formatCount(sum(bought))} of them bought Pro or credits within 14 days. Each month shows hits next to buyers. Not affected by the range.`}
        labels={months.map((m) => formatMonth(m.month))}
        fullLabels={months.map((m) => formatMonth(m.month))}
        series={[
          { name: "Reached the limit", values: reached },
          { name: "Bought within 14 days", values: bought },
        ]}
        notes={rate}
        extraColumn={{ heading: "Conversion", values: rate }}
        unit="count"
        emptyText="No Free account has reached its limit in the last 6 months."
      />
    </Section>
  );
}

export function TopAccounts({ data }: { data: AdminAnalytics }) {
  const top = Math.max(1, ...data.topAccounts.map((account) => account.readyInvoices));
  return (
    <Section id="top-title" title="Top accounts" note={data.definitions.topAccounts}>
      <Panel title="Most invoices made Ready">
        {data.topAccounts.length === 0 ? (
          <EmptyRow text="No invoices were made Ready in this range." />
        ) : (
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={thClass}>
                  Account
                </th>
                <th scope="col" className={thClass}>
                  Email
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Invoices made Ready
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topAccounts.map((account) => (
                <tr key={account.accountId} className="border-t border-line">
                  <th scope="row" className={`${tdClass} text-left font-normal`}>
                    <AdminLink
                      href={tenantHref(account.accountId)}
                      className="text-accent hover:underline"
                    >
                      {account.name}
                    </AdminLink>
                  </th>
                  <td className={`${tdClass} break-all text-sub`}>{account.email}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    <div className="flex items-center justify-end gap-3">
                      <span aria-hidden className="h-2 w-16 overflow-hidden rounded-full bg-soft">
                        <span
                          className="block h-full rounded-full bg-series-1"
                          style={{ width: `${(account.readyInvoices / top) * 100}%` }}
                        />
                      </span>
                      {formatCount(account.readyInvoices)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Section>
  );
}
