import type { AdminUserRow } from "@billsafi/contracts";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { formatDay } from "../admin-format";
import { tenantHref } from "../admin-params";
import { CopyButton } from "../copy-button";
import { StatusBadge } from "../status-badge";
import { RevokeSessionsButton } from "./revoke-sessions-button";
import { lastLoginText } from "./user-text";

/** The user's name, badges, ids and the revoke action. */
export function UserHeader({ user, selfId }: { user: AdminUserRow; selfId: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-80">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{user.name}</h1>
        <p className="mt-1 text-sm break-all text-sub">{user.email}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge kind="role" value={user.role} labelled />
          <StatusBadge kind="account" value={user.accountStatus} labelled />
        </div>
        <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div className="flex min-w-0 items-center gap-1">
            <dt className="whitespace-nowrap text-sub">User ID</dt>
            <dd className="flex min-w-0 items-center">
              <code className="truncate font-mono text-xs">{user.id}</code>
              <CopyButton value={user.id} label="Copy user ID" />
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-sub">Registered</dt>
            <dd>{formatDay(user.registeredAt)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-sub">Last login</dt>
            <dd>{lastLoginText(user.lastLoginAt)}</dd>
          </div>
        </dl>
        <Link
          href={tenantHref(user.tenantId)}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0"
        >
          <Building2 aria-hidden className="size-4" />
          Open their account
        </Link>
      </div>
      <RevokeSessionsButton
        target={{ id: user.id, name: user.name, email: user.email }}
        isSelf={user.id === selfId}
      />
    </div>
  );
}
