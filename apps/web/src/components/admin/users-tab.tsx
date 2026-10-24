import type { AdminPlan, AdminSignInMethod, AdminUsersPage } from "@billsafi/contracts";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { formatCount, formatDay } from "./admin-format";
import { AdminLink, ClickableRow } from "./admin-link";
import { type AdminState, adminHref } from "./admin-params";
import { EmptyRow, Panel, UpdatedAt, tdClass, thClass, theadClass } from "./admin-ui";

export const methodLabels: Record<AdminSignInMethod, string> = {
  google: "Google",
  email: "Email",
};

export function planText(plan: AdminPlan): string {
  return plan.code === "pro" && plan.proUntil ? `Pro until ${formatDay(plan.proUntil)}` : "Free";
}

export function lastActiveText(lastActiveAt: string | null): string {
  return lastActiveAt ? formatDay(lastActiveAt) : "No recent session";
}

function UserSearch({ search }: { search?: string }) {
  return (
    <Form action="/admin" role="search" className="relative max-w-md">
      <input type="hidden" name="tab" value="users" />
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-sub"
      />
      <input
        name="search"
        type="search"
        defaultValue={search}
        maxLength={100}
        aria-label="Search users"
        placeholder="Search name or email"
        className="w-full rounded-panel border border-line bg-panel py-2.5 pr-2.5 pl-8.5 text-sm"
      />
    </Form>
  );
}

const headings = [
  "User",
  "Sign-in",
  "Plan",
  "Signed up",
  "Businesses",
  "Ready invoices",
  "Last active",
];

export function UsersTab({ data, state }: { data: AdminUsersPage; state: AdminState }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);

  return (
    <div className="space-y-4">
      <UserSearch search={state.search} />
      <Panel
        title="Users"
        description={
          state.search
            ? `${formatCount(data.total)} matching "${state.search}". Open a row for details.`
            : `${formatCount(data.total)} in total, newest first. Open a row for details.`
        }
      >
        {data.users.length === 0 ? (
          <EmptyRow text={state.search ? "No users match this search." : "No users yet."} />
        ) : (
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                {headings.map((heading) => (
                  <th key={heading} scope="col" className={thClass}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => {
                const href = adminHref(state, { user: user.id });
                return (
                  <ClickableRow key={user.id} href={href}>
                    <td className={tdClass}>
                      <Link href={href} className="font-medium hover:text-accent hover:underline">
                        {user.name}
                      </Link>
                      <p className="text-xs text-sub">{user.email}</p>
                    </td>
                    <td className={tdClass}>{methodLabels[user.signInMethod]}</td>
                    <td className={tdClass}>{planText(user.plan)}</td>
                    <td className={`${tdClass} text-sub`}>{formatDay(user.signedUpAt)}</td>
                    <td className={`${tdClass} tabular-nums`}>{formatCount(user.businesses)}</td>
                    <td className={`${tdClass} tabular-nums`}>{formatCount(user.invoicesReady)}</td>
                    <td className={`${tdClass} text-sub`}>{lastActiveText(user.lastActiveAt)}</td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {data.total > 0 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-sub">
            {formatCount(from)} to {formatCount(to)} of {formatCount(data.total)}
          </p>
          <div className="flex gap-2">
            {data.page > 1 && (
              <AdminLink
                href={adminHref(state, { page: data.page - 1 })}
                className="rounded-panel border border-line bg-panel px-3 py-2 text-sm hover:bg-soft"
              >
                <ChevronLeft aria-hidden className="size-4" />
                Previous
              </AdminLink>
            )}
            {data.page < pages && (
              <AdminLink
                href={adminHref(state, { page: data.page + 1 })}
                className="rounded-panel border border-line bg-panel px-3 py-2 text-sm hover:bg-soft"
              >
                Next
                <ChevronRight aria-hidden className="size-4" />
              </AdminLink>
            )}
          </div>
        </nav>
      )}
      <UpdatedAt iso={data.generatedAt} />
    </div>
  );
}
