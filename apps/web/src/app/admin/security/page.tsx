import { History, SearchX, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { formatInstant, formatRelative } from "@/components/admin/admin-format";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  auditDefaults,
  failedSignInsDefaults,
  hrefWith,
  parseAuditParams,
  parseFailedSignInsParams,
  parseSecurityTab,
  toQuery,
} from "@/components/admin/admin-params";
import { EmptyState, PastEndState, UpdatedAt } from "@/components/admin/admin-ui";
import { auditFilters } from "@/components/admin/audit/audit-filters";
import { AuditTable } from "@/components/admin/audit/audit-table";
import { Pagination } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/page-skeleton";
import { UrlTabs } from "@/components/admin/url-tabs";
import { failedSignInFilters } from "@/components/admin/security/failed-sign-in-filters";
import {
  FailedSignInSummary,
  FailedSignInTable,
} from "@/components/admin/security/failed-sign-ins";
import { getAdminAuditLogs, getAdminFailedSignIns } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Security & Audit");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Security & Audit"
    description="Every admin action, and every failed sign-in. Audit entries can't be edited or deleted."
  />
);

const tabs = [
  { key: "audit", label: "Audit log", href: "/admin/security" },
  { key: "failed-sign-ins", label: "Failed sign-ins", href: "/admin/security?tab=failed-sign-ins" },
];

async function FailedSignIns({
  raw,
}: {
  raw: Awaited<PageProps<"/admin/security">["searchParams"]>;
}) {
  const state = parseFailedSignInsParams(raw);
  const query = toQuery(state, failedSignInsDefaults);
  const data = await getAdminFailedSignIns(query);
  const path = "/admin/security";
  const withTab = { tab: "failed-sign-ins" };
  const filtered = toQuery({ ...state, page: undefined }, failedSignInsDefaults) !== "";
  const href = (changes: Record<string, string | number>) =>
    hrefWith(path, { ...state, ...withTab }, changes, failedSignInsDefaults);

  return (
    <div className="space-y-3">
      <FailedSignInSummary summary={data.summary} />
      <section className="min-w-0 rounded-panel border border-line bg-panel">
        <FilterBar label="Filter failed sign-ins" fields={failedSignInFilters} />
        {data.items.length === 0 && data.total > 0 ? (
          <PastEndState firstPageHref={href({ page: 1 })} />
        ) : data.items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="No failed sign-ins match these filters"
              action={
                <Link
                  href="/admin/security?tab=failed-sign-ins"
                  className="text-sm text-accent hover:underline"
                >
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState icon={ShieldCheck} title="No failed sign-ins in this range" />
          )
        ) : (
          <FailedSignInTable data={data} />
        )}
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          href={(page) => href({ page })}
        />
      </section>
      <UpdatedAt iso={data.generatedAt} cached={false} />
    </div>
  );
}

async function AuditLog({ searchParams }: PageProps<"/admin/security">) {
  const raw = await searchParams;
  const tab = parseSecurityTab(raw);
  if (tab === "failed-sign-ins")
    return (
      <>
        {header}
        <UrlTabs label="Security sections" tabs={tabs} current={tab} />
        <FailedSignIns raw={raw} />
      </>
    );
  const state = parseAuditParams(raw);
  const data = await getAdminAuditLogs(toQuery(state, auditDefaults));
  const filtered = toQuery({ ...state, page: undefined }) !== "";

  return (
    <>
      {header}
      <UrlTabs label="Security sections" tabs={tabs} current={tab} />
      <div className="space-y-3">
        <section className="min-w-0 rounded-panel border border-line bg-panel">
          <FilterBar label="Filter audit events" fields={auditFilters} />
          {data.entries.length === 0 && data.total > 0 ? (
            <PastEndState
              firstPageHref={hrefWith("/admin/security", state, { page: 1 }, auditDefaults)}
            />
          ) : data.entries.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No events match these filters"
                action={
                  <Link href="/admin/security" className="text-sm text-accent hover:underline">
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={History}
                title="No audit events yet"
                description="Every admin action, and every change to who is an admin, is recorded here."
              />
            )
          ) : (
            <AuditTable
              entries={data.entries.map((entry) => ({
                ...entry,
                when: formatInstant(entry.occurredAt),
                ago: formatRelative(entry.occurredAt, Date.parse(data.generatedAt)),
              }))}
            />
          )}
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            href={(page) => hrefWith("/admin/security", state, { page }, auditDefaults)}
          />
        </section>
        <UpdatedAt iso={data.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function SecurityPage(props: PageProps<"/admin/security">) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading audit events" />}>
      <AuditLog {...props} />
    </Suspense>
  );
}
