import type { AdminFailedSignInsPage } from "@billsafi/contracts";
import { formatCount, formatInstant, formatRelative } from "../admin-format";
import { InfoPopover } from "../info-popover";
import { ScrollArea } from "../scroll-area";
import { StatusBadge } from "../status-badge";
import { tdClass, thClass, theadClass } from "../table-classes";
import { methodLabels } from "./failed-sign-in-filters";

function Figure({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="min-w-0 rounded-panel border border-line bg-panel p-4">
      <p className="flex items-center gap-1 text-sm text-sub">
        {label}
        <InfoPopover label={`What does ${label} mean?`}>{help}</InfoPopover>
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCount(value)}</p>
    </div>
  );
}

function Ranked({
  title,
  help,
  rows,
}: {
  title: string;
  help: string;
  rows: { name: string; count: number }[];
}) {
  return (
    <div className="min-w-0 rounded-panel border border-line bg-panel p-4">
      <h3 className="flex items-center gap-1 text-sm font-medium">
        {title}
        <InfoPopover label={`What does ${title} show?`}>{help}</InfoPopover>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-sub">None in the last 24 hours.</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {rows.map((row, index) => (
            <li key={row.name} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 break-all">
                <span className="text-sub tabular-nums">{index + 1}. </span>
                {row.name}
              </span>
              <span className="font-semibold tabular-nums">{formatCount(row.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Counts and the two short ranked lists. They ignore the filters. */
export function FailedSignInSummary({ summary }: { summary: AdminFailedSignInsPage["summary"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Figure
        label="Last 24 hours"
        value={summary.last24h}
        help="Failed sign-ins and refused sign-ups in the last 24 hours, whatever the filters."
      />
      <Figure
        label="Last 7 days"
        value={summary.last7d}
        help="Failed sign-ins and refused sign-ups in the last 7 days, whatever the filters."
      />
      <Ranked
        title="Top emails"
        help="Emails with the most failures in the last 24 hours."
        rows={summary.topEmails.map((row) => ({ name: row.email, count: row.count }))}
      />
      <Ranked
        title="Top networks"
        help="Masked networks with the most failures in the last 24 hours. Only the network part of an address is kept."
        rows={summary.topIps.map((row) => ({ name: row.ipMasked, count: row.count }))}
      />
    </div>
  );
}

export function FailedSignInTable({ data }: { data: AdminFailedSignInsPage }) {
  const now = Date.parse(data.generatedAt);
  return (
    <ScrollArea label="Failed sign-ins">
      <table className="w-full text-sm">
        <caption className="sr-only">Failed sign-ins, newest first</caption>
        <thead className={theadClass}>
          <tr>
            {["Time", "Email", "Method", "Reason", "Network"].map((label) => (
              <th key={label} scope="col" className={thClass}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className={`${tdClass} whitespace-nowrap`}>
                <time dateTime={row.occurredAt}>{formatInstant(row.occurredAt)}</time>
                <span className="block text-xs text-sub">
                  {formatRelative(row.occurredAt, now)}
                </span>
              </td>
              <td className={`${tdClass} min-w-56 max-w-64 break-all`}>
                {row.email ?? (
                  <>
                    <span aria-hidden className="text-sub">
                      -
                    </span>
                    <span className="sr-only">No email</span>
                  </>
                )}
              </td>
              <td className={`${tdClass} whitespace-nowrap`}>{methodLabels[row.method]}</td>
              <td className={tdClass}>
                <StatusBadge kind="signInReason" value={row.reason} />
              </td>
              <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                {row.ipMasked ?? (
                  <>
                    <span aria-hidden className="text-sub">
                      -
                    </span>
                    <span className="sr-only">No address</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
