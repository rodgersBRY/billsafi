import { SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  hrefWith,
  parseUsersParams,
  toQuery,
  usersDefaults,
} from "@/components/admin/admin-params";
import { EmptyState, UpdatedAt } from "@/components/admin/admin-ui";
import { Pagination } from "@/components/admin/data-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { userFilters } from "@/components/admin/users/user-filters";
import { UserTable } from "@/components/admin/users/user-table";
import { getAdminUsers } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Users");

/** Rendered with the data, after the API has confirmed admin access. */
const header = (
  <PageHeader
    title="Users"
    description="Who can sign in, how, and when they last did. Each user owns exactly one account."
  />
);

async function Users({ searchParams }: PageProps<"/admin/users">) {
  const state = parseUsersParams(await searchParams);
  const data = await getAdminUsers(toQuery(state, usersDefaults));
  const filtered = toQuery({ ...state, page: undefined, sort: undefined, dir: undefined }) !== "";
  const href = (changes: Record<string, string | number | undefined>) =>
    hrefWith("/admin/users", state, changes, usersDefaults);

  return (
    <>
      {header}
      <div className="space-y-3">
        <section className="min-w-0 rounded-panel border border-line bg-panel">
          <FilterBar label="Filter users" fields={userFilters} />
          {data.users.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No users match these filters"
                description="Try a shorter search or clear a filter."
                action={
                  <Link href="/admin/users" className="text-sm text-accent hover:underline">
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState title="No users yet" />
            )
          ) : (
            <UserTable
              users={data.users}
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

export default function UsersPage(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading users" />}>
      <Users {...props} />
    </Suspense>
  );
}
