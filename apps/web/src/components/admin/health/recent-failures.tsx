import type { AdminFailuresPage } from "@billsafi/contracts";
import { CircleCheck } from "lucide-react";
import { formatCount, formatInstant, formatRelative } from "../admin-format";
import { AdminLink } from "../admin-link";
import { tenantHref } from "../admin-params";
import { EmptyState } from "../admin-ui";
import { Pagination } from "../data-table";
import { InfoPopover } from "../info-popover";
import { ScrollArea } from "../scroll-area";
import { StatusBadge } from "../status-badge";
import { tdClass, thClass, theadClass } from "../table-classes";
import { UrlTabs } from "../url-tabs";

const kinds = [
  { key: "all", label: "All", count: (d: AdminFailuresPage["last24h"]) => d.pdf + d.email + d.job },
  { key: "pdf", label: "PDF", count: (d: AdminFailuresPage["last24h"]) => d.pdf },
  { key: "email", label: "Email", count: (d: AdminFailuresPage["last24h"]) => d.email },
  { key: "job", label: "Jobs", count: (d: AdminFailuresPage["last24h"]) => d.job },
] as const;

const href = (kind: string, page?: number) => {
  const params = new URLSearchParams();
  if (kind !== "all") params.set("kind", kind);
  if (page && page > 1) params.set("page", String(page));
  const text = params.toString();
  return `/admin/health${text ? `?${text}` : ""}#recent-failures`;
};

/** Recent PDF, email and job failures with kind tabs and paging. */
export function RecentFailures({
  data,
  kind,
}: {
  data: AdminFailuresPage;
  kind: "all" | "pdf" | "email" | "job";
}) {
  const now = Date.parse(data.generatedAt);
  return (
    <section id="recent-failures" aria-labelledby="failures-title" className="mt-8 scroll-mt-20">
      <h2 id="failures-title" className="mb-3 flex items-center gap-1.5 text-base font-semibold">
        Recent failures
        <InfoPopover label="About recent failures">
          Failed PDFs, emails and background jobs, newest first. Messages have addresses, links,
          phone numbers and tokens removed. Kept for 90 days. The counts on the tabs are the last 24
          hours.
        </InfoPopover>
      </h2>
      <UrlTabs
        label="Failure kinds"
        current={kind}
        tabs={kinds.map((item) => ({
          key: item.key,
          label: `${item.label} (${formatCount(item.count(data.last24h))})`,
          href: href(item.key),
        }))}
      />
      <div className="min-w-0 rounded-panel border border-line bg-panel">
        {data.items.length === 0 ? (
          <EmptyState icon={CircleCheck} title="No failures recorded" />
        ) : (
          <ScrollArea label="Recent failures">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent failures, newest first</caption>
              <thead className={theadClass}>
                <tr>
                  {["Time", "Kind", "Operation", "Account", "Error", "Message"].map((label) => (
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
                    <td className={tdClass}>
                      <StatusBadge kind="failureKind" value={row.kind} />
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {row.operation}
                    </td>
                    <td className={`${tdClass} max-w-48 break-words`}>
                      {row.account ? (
                        <AdminLink
                          href={tenantHref(row.account.id)}
                          className="text-accent hover:underline"
                        >
                          {row.account.name}
                        </AdminLink>
                      ) : (
                        <>
                          <span aria-hidden className="text-sub">
                            -
                          </span>
                          <span className="sr-only">No account</span>
                        </>
                      )}
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {row.errorClass}
                    </td>
                    <td className={`${tdClass} min-w-64 break-words`}>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          href={(page) => href(kind, page)}
        />
      </div>
    </section>
  );
}
