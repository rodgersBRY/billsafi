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
    <Form action="/admin" role="search" className="flex max-w-md gap-2">
      <input type="hidden" name="tab" value="users" />
      <input
        name="search"
        type="search"
        defaultValue={search}
        maxLength={100}
        aria-label="Search users"
        placeholder="Search name or email"
        className="min-w-0 flex-1 rounded-panel border border-line bg-panel px-3 py-2.5 text-sm"
      />
      <button
        type="submit"
        className="inline-flex items-center rounded-panel border border-teal bg-teal px-3 text-white hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Search aria-hidden className="size-4" />
        <span className="sr-only">Search</span>
      </button>
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
  // Counted from the rows returned, so a page past the end never shows a bogus range.
  const from = data.users.length === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = from === 0 ? 0 : from + data.users.length - 1;

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
        {data.users.length === 0 && data.total > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-5 text-sm text-sub">
            <p>No users on this page.</p>
            <AdminLink
              href={adminHref(state, { page: 1 })}
              className="font-medium text-accent hover:underline"
            >
              Go to page 1
            </AdminLink>
          </div>
        ) : data.users.length === 0 ? (
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
      {to > 0 && (
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
            {data.page < pages && to > 0 && (
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
