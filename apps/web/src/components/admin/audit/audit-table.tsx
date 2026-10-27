"use client";

import type { AdminAuditRow } from "@billsafi/contracts";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { tenantHref, userHref } from "../admin-params";
import { ScrollArea } from "../scroll-area";
import { tdClass, thClass, theadClass } from "../table-classes";
import { StatusBadge } from "../status-badge";
import { actionLabel, actorLabel, targetLabel } from "./audit-labels";

const th = thClass;
const td = tdClass;

/**
 * An audit row with its times already formatted on the server, so the server and browser
 * renders agree whatever the browser's clock or locale data.
 */
export type AuditDisplayRow = AdminAuditRow & { when: string; ago: string };

function targetHref(target: AdminAuditRow["target"]): string | null {
  if (target.type === "account") return tenantHref(target.id);
  if (target.type === "user") return userHref(target.id);
  return null;
}

function Details({ entry }: { entry: AdminAuditRow }) {
  const facts: [string, React.ReactNode][] = [
    ["Reason", entry.reason ?? "None given"],
    [
      "Request ID",
      entry.requestId ? (
        <code key="r" className="font-mono text-xs break-all">
          {entry.requestId}
        </code>
      ) : (
        "None"
      ),
    ],
    [
      "IP address",
      entry.ipAddress ? (
        <code key="i" className="font-mono text-xs">
          {entry.ipAddress}
        </code>
      ) : (
        "None"
      ),
    ],
    [
      "Event ID",
      <code key="e" className="font-mono text-xs break-all">
        {entry.id}
      </code>,
    ],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <dl className="space-y-2">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-sub">{label}</dt>
            <dd className="text-sm break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="min-w-0">
        <p className="text-xs text-sub">Changes (secrets removed, phones masked)</p>
        <pre className="mt-1 max-h-64 overflow-auto rounded-panel border border-line bg-background p-3 font-mono text-xs break-words whitespace-pre-wrap">
          {entry.changes === null || entry.changes === undefined
            ? "None"
            : JSON.stringify(entry.changes, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/** The audit log. Each row opens to show the reason, changes, request ID and address. */
export function AuditTable({ entries }: { entries: AuditDisplayRow[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ScrollArea label="Audit events">
      <table className="w-full text-sm">
        <caption className="sr-only">Audit events, newest first</caption>
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={th}>
              <span className="sr-only">Details</span>
            </th>
            <th scope="col" className={th}>
              Time
            </th>
            <th scope="col" className={th}>
              Actor
            </th>
            <th scope="col" className={th}>
              Action
            </th>
            <th scope="col" className={th}>
              Target
            </th>
            <th scope="col" className={th}>
              Outcome
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const expanded = open.has(entry.id);
            const href = targetHref(entry.target);
            const detailsId = `audit-${entry.id}`;
            return (
              <Fragment key={entry.id}>
                <tr className="border-t border-line">
                  <td className={`${td} py-1.5 pr-0`}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={detailsId}
                      onClick={() => toggle(entry.id)}
                      className="grid size-11 place-items-center rounded-panel text-sub hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:size-9"
                    >
                      <ChevronRight
                        aria-hidden
                        className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
                      />
                      <span className="sr-only">
                        {expanded ? "Hide" : "Show"} details for {actionLabel(entry.action)}
                      </span>
                    </button>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    <time dateTime={entry.occurredAt}>{entry.when}</time>
                    <span className="block text-xs text-sub">{entry.ago}</span>
                  </td>
                  <td className={`${td} max-w-56 break-all`}>{actorLabel(entry.actor)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {actionLabel(entry.action)}
                    <code className="block font-mono text-xs text-sub">{entry.action}</code>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {targetLabel(entry.target.type)}
                    {href ? (
                      <Link
                        href={href}
                        className="block font-mono text-xs text-accent hover:underline"
                      >
                        {entry.target.id.slice(0, 8)}
                        <span className="sr-only"> (open {targetLabel(entry.target.type)})</span>
                      </Link>
                    ) : (
                      <code className="block font-mono text-xs text-sub">{entry.target.id}</code>
                    )}
                  </td>
                  <td className={td}>
                    <StatusBadge kind="outcome" value={entry.outcome} />
                  </td>
                </tr>
                <tr id={detailsId} hidden={!expanded} className="bg-background">
                  <td colSpan={6} className="px-4 py-4">
                    {expanded && <Details entry={entry} />}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}
