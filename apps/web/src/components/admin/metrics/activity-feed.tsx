import type { AdminActivityItem, AdminActivityKind } from "@billsafi/contracts";
import {
  Ban,
  Banknote,
  FileCheck2,
  Gift,
  KeyRound,
  LogOut,
  type LucideIcon,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  UserPlus,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { formatInstant, formatRelative } from "../admin-format";
import { tenantHref } from "../admin-params";

const icons: Record<AdminActivityKind, LucideIcon> = {
  signed_up: UserPlus,
  first_invoice_ready: FileCheck2,
  pro_payment: Banknote,
  credit_pack: Package,
  mpesa_failed: TriangleAlert,
  grant_given: Gift,
  override_added: SlidersHorizontal,
  pro_ended: XCircle,
  account_suspended: Ban,
  account_reactivated: ShieldCheck,
  sessions_revoked: LogOut,
};

/** Recent platform events, newest first, each linking to the account it concerns. */
export function ActivityFeed({ items, now }: { items: AdminActivityItem[]; now: number }) {
  return (
    <section
      aria-labelledby="activity-title"
      className="min-w-0 rounded-panel border border-line bg-panel"
    >
      <h2 id="activity-title" className="px-4 pt-4 text-base font-semibold">
        Recent activity
      </h2>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-sub">Nothing has happened on the platform yet.</p>
      ) : (
        <ul className="mt-2 max-h-136 divide-y divide-line overflow-y-auto">
          {items.map((item) => {
            const Icon = icons[item.kind] ?? KeyRound;
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-sub" />
                <div className="min-w-0 flex-1 text-sm">
                  {item.account && (
                    <Link
                      href={tenantHref(item.account.id)}
                      className="font-medium break-words text-accent hover:underline"
                    >
                      {item.account.name}
                    </Link>
                  )}
                  <p className="break-words">{item.summary}</p>
                  <p className="mt-0.5 text-xs text-sub">
                    <time dateTime={item.at} title={formatInstant(item.at)}>
                      {formatRelative(item.at, now)}
                    </time>
                    {item.admin && ` by ${item.admin.name}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
