import type { AdminTenantActivityItem, AdminTenantActivityPage } from "@billsafi/contracts";
import {
  FileDown,
  Link2,
  Mail,
  Cog,
  FileText,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { formatInstant, formatRelative } from "../admin-format";
import { Pagination } from "../data-table";
import { EmptyState, Panel } from "../admin-ui";
import { tenantHref } from "../admin-params";

const icons: Record<string, LucideIcon> = {
  pdf_downloaded: FileDown,
  link_opened: Link2,
  guest_invoice_imported: Sparkles,
  pdf: FileText,
  email: Mail,
  job: Cog,
};

function Row({ item, now }: { item: AdminTenantActivityItem; now: number }) {
  const failure = item.type === "failure";
  const Icon = icons[item.name] ?? (failure ? TriangleAlert : FileDown);
  return (
    <li className="flex gap-3 px-4 py-3">
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${failure ? "text-red-700 dark:text-red-300" : "text-sub"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm break-words">
          {failure && <span className="font-medium">Failed: </span>}
          {item.summary}
        </p>
        {item.detail && <p className="mt-0.5 text-sm break-words text-sub">{item.detail}</p>}
        <p className="mt-1 text-xs text-sub">
          <time dateTime={item.occurredAt} title={formatInstant(item.occurredAt)}>
            {formatRelative(item.occurredAt, now)}
          </time>
        </p>
      </div>
    </li>
  );
}

/** The account's recorded events and failures, newest first, with paging. */
export function TenantActivityFeed({ data }: { data: AdminTenantActivityPage }) {
  const now = Date.parse(data.generatedAt);
  return (
    <Panel
      id="recorded-activity"
      title="Product use and failures"
      description="PDF downloads, shared link opens and failed PDFs, emails and jobs for this account."
    >
      {data.items.length === 0 ? (
        <EmptyState icon={FileDown} title="Nothing recorded for this account yet" />
      ) : (
        <ol className="divide-y divide-line">
          {data.items.map((item) => (
            <Row key={`${item.type}-${item.id}`} item={item} now={now} />
          ))}
        </ol>
      )}
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        href={(page) =>
          `${tenantHref(data.accountId, "activity")}${page > 1 ? `&page=${page}` : ""}#recorded-activity`
        }
      />
    </Panel>
  );
}

export { Link };
