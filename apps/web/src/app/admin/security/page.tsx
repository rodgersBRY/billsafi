import { History, SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  auditDefaults,
  hrefWith,
  parseAuditParams,
  toQuery,
} from "@/components/admin/admin-params";
import { EmptyState, UpdatedAt } from "@/components/admin/admin-ui";
import { auditFilters } from "@/components/admin/audit/audit-filters";
import { AuditTable } from "@/components/admin/audit/audit-table";
import { Pagination } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { getAdminAuditLogs } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Security & Audit");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Security & Audit"
    description="Every admin action, successful or not. Entries can't be edited or deleted."
  />
);

async function AuditLog({ searchParams }: PageProps<"/admin/security">) {
  const state = parseAuditParams(await searchParams);
  const data = await getAdminAuditLogs(toQuery(state, auditDefaults));
  const filtered = toQuery({ ...state, page: undefined }) !== "";

  return (
    <>
      {header}
      <div className="space-y-3">
        <section className="min-w-0 rounded-panel border border-line bg-panel">
          <FilterBar label="Filter audit events" fields={auditFilters} />
          {data.entries.length === 0 ? (
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
            <AuditTable entries={data.entries} now={data.generatedAt} />
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
    <Suspense fallback={<PageSkeleton label="Loading audit events" />}>
      <AuditLog {...props} />
    </Suspense>
  );
}
