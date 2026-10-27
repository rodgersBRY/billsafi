import { SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  hrefWith,
  parseTenantsParams,
  tenantsDefaults,
  toQuery,
} from "@/components/admin/admin-params";
import { EmptyState, PastEndState, UpdatedAt } from "@/components/admin/admin-ui";
import { Pagination } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/page-skeleton";
import { tenantFilters } from "@/components/admin/tenants/tenant-filters";
import { TenantTable } from "@/components/admin/tenants/tenant-table";
import { getAdminSelf, getAdminTenants } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Tenants");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Tenants"
    description="Every account, with its businesses, plan and statuses. An account is one owner and the businesses they run."
  />
);

async function Tenants({ searchParams }: PageProps<"/admin/tenants">) {
  const state = parseTenantsParams(await searchParams);
  const [data, self] = await Promise.all([
    getAdminTenants(toQuery(state, tenantsDefaults)),
    getAdminSelf(),
  ]);
  const filtered = toQuery({ ...state, page: undefined, sort: undefined, dir: undefined }) !== "";
  const href = (changes: Record<string, string | number | undefined>) =>
    hrefWith("/admin/tenants", state, changes, tenantsDefaults);

  return (
    <>
      {header}
      <div className="space-y-3">
        <section className="min-w-0 rounded-panel border border-line bg-panel">
          <FilterBar label="Filter tenants" fields={tenantFilters} />
          {data.tenants.length === 0 && data.total > 0 ? (
            <PastEndState firstPageHref={href({ page: 1 })} />
          ) : data.tenants.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No tenants match these filters"
                description="Try a shorter search or clear a filter."
                action={
                  <Link href="/admin/tenants" className="text-sm text-accent hover:underline">
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title="No tenants yet"
                description="Accounts appear here once people sign up."
              />
            )
          ) : (
            <TenantTable
              tenants={data.tenants}
              selfId={self.id}
              sort={{ sort: state.sort, dir: state.dir }}
              sortHref={(sort, dir) => href({ sort, dir, page: 1 })}
            />
          )}
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            href={(page) => href({ page })}
          />
        </section>
        <UpdatedAt iso={data.generatedAt} />
      </div>
    </>
  );
}

export default function TenantsPage(props: PageProps<"/admin/tenants">) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading tenants" />}>
      <Tenants {...props} />
    </Suspense>
  );
}
