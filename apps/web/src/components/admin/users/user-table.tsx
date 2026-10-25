import type { AdminUserRow } from "@billsafi/contracts";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { formatDay, formatInstant } from "../admin-format";
import { ClickableRow } from "../admin-link";
import { tenantHref, userHref } from "../admin-params";
import { type Column, DataTable, tdClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { lastLoginText, methodsText } from "./user-text";

const columns: Column[] = [
  { label: "Name and email" },
  { label: "Role" },
  { label: "Account" },
  { label: "Sign-in" },
  { label: "Registered", sort: "registered" },
  { label: "Last login", sort: "lastLogin" },
  { label: "Tenant" },
];

interface UserTableProps {
  users: AdminUserRow[];
  sort: { sort: string; dir: "asc" | "desc" };
  sortHref: (sort: string, dir: "asc" | "desc") => string;
}

function TenantLink({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={tenantHref(id)}
      className="inline-flex min-h-11 items-center gap-1 text-sm text-accent hover:underline md:min-h-0"
    >
      <Building2 aria-hidden className="size-4" />
      Account
      <span className="sr-only"> of {name}</span>
    </Link>
  );
}

function LastLogin({ iso }: { iso: string | null }) {
  return iso ? (
    <time dateTime={iso} title={formatInstant(iso)}>
      {lastLoginText(iso)}
    </time>
  ) : (
    <>{lastLoginText(null)}</>
  );
}

function UserCards({ users }: { users: AdminUserRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {users.map((user) => (
        <li key={user.id} className="p-4">
          <Link
            href={userHref(user.id)}
            className="block font-medium break-words hover:text-accent hover:underline"
          >
            {user.name}
          </Link>
          <p className="text-sm break-all text-sub">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge kind="role" value={user.role} labelled />
            <StatusBadge kind="account" value={user.accountStatus} labelled />
          </div>
          <p className="mt-2 text-xs text-sub">
            Signs in with {methodsText(user.signInMethods)}. Last login{" "}
            <LastLogin iso={user.lastLoginAt} />.
          </p>
          <TenantLink id={user.tenantId} name={user.name} />
        </li>
      ))}
    </ul>
  );
}

/** The users directory: identity and access, with a link to each user's account. */
export function UserTable({ users, sort, sortHref }: UserTableProps) {
  return (
    <DataTable
      caption="Users"
      columns={columns}
      sort={sort}
      sortHref={sortHref}
      mobile={<UserCards users={users} />}
    >
      {users.map((user) => (
        <ClickableRow key={user.id} href={userHref(user.id)}>
          <td className={`${tdClass} max-w-72 min-w-60`}>
            <Link
              href={userHref(user.id)}
              className="font-medium break-words hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {user.name}
            </Link>
            <p className="text-xs break-all text-sub">{user.email}</p>
          </td>
          <td className={tdClass}>
            <StatusBadge kind="role" value={user.role} />
          </td>
          <td className={tdClass}>
            <StatusBadge kind="account" value={user.accountStatus} />
          </td>
          <td className={`${tdClass} whitespace-nowrap`}>{methodsText(user.signInMethods)}</td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            {formatDay(user.registeredAt)}
          </td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            <LastLogin iso={user.lastLoginAt} />
          </td>
          <td className={`${tdClass} whitespace-nowrap`}>
            <TenantLink id={user.tenantId} name={user.name} />
          </td>
        </ClickableRow>
      ))}
    </DataTable>
  );
}
