import type { AdminAuditRow } from "@billsafi/contracts";
import { ArrowRight, History } from "lucide-react";
import Link from "next/link";
import { formatInstant, formatRelative } from "../admin-format";
import { auditHref } from "../admin-params";
import { EmptyState } from "../admin-ui";
import { StatusBadge } from "../status-badge";
import { actionLabel, actorLabel } from "./audit-labels";

interface AuditTimelineProps {
  entries: AdminAuditRow[];
  /** Target id for the "View all" link to Security & Audit. */
  targetId: string;
}

/** Recent audit rows about one account or user, newest first. */
export function AuditTimeline({ entries, targetId }: AuditTimelineProps) {
  return (
    <div>
      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="No admin actions yet"
          description="Suspensions, reactivations and session revokes for this account show up here."
        />
      ) : (
        <ol className="divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <p className="text-xs text-sub">
                <time dateTime={entry.occurredAt} className="block text-sm text-ink">
                  {formatInstant(entry.occurredAt)}
                </time>
                {formatRelative(entry.occurredAt)}
              </p>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{actionLabel(entry.action)}</p>
                  <StatusBadge kind="outcome" value={entry.outcome} />
                </div>
                <p className="text-xs break-all text-sub">By {actorLabel(entry.actor)}</p>
                {entry.reason && (
                  <p className="mt-1 text-sm break-words">
                    <span className="text-sub">Reason: </span>
                    {entry.reason}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="border-t border-line px-4 py-3">
        <Link
          href={auditHref({ targetId })}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0"
        >
          View all in Security & Audit
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  );
}
