import type {
  AdminSupportNote,
  AdminSupportPerson,
  AdminSupportTimelineEntry,
} from "@billsafi/contracts";
import { History, StickyNote } from "lucide-react";
import { formatInstant, formatRelative } from "../admin-format";
import { EmptyState } from "../admin-ui";
import { categoryLabels, severityLabels, supportStatusLabels } from "../status-badge";
import { changeFieldLabels, timelineActionLabels } from "./support-text";

type Item =
  | { kind: "note"; at: string; id: string; note: AdminSupportNote }
  | { kind: "event"; at: string; id: string; entry: AdminSupportTimelineEntry };

const valueLabels: Record<string, Record<string, string>> = {
  status: supportStatusLabels,
  severity: severityLabels,
  category: categoryLabels,
};

function valueText(field: string, value: unknown): string {
  if (field === "assignedTo") return value ? "assigned" : "nobody";
  if (typeof value !== "string") return "none";
  return valueLabels[field]?.[value] ?? value;
}

/** "Status: Open to Waiting" lines from the audit before and after values. */
function changeLines(changes: unknown): string[] {
  if (!changes || typeof changes !== "object") return [];
  const lines: string[] = [];
  for (const [field, change] of Object.entries(changes)) {
    const label = changeFieldLabels[field];
    if (!label || !change || typeof change !== "object" || !("to" in change)) continue;
    const { from, to } = change as { from?: unknown; to: unknown };
    lines.push(
      field === "title"
        ? `${label} changed`
        : `${label}: ${valueText(field, from)} to ${valueText(field, to)}`,
    );
  }
  return lines;
}

/**
 * Audit rows carry only an email, but notes and the assignee carry names. Join them by user
 * id or email so every actor shows as a name, and use the email only when no name is known.
 */
function actorName(entry: AdminSupportTimelineEntry, people: AdminSupportPerson[]): string {
  const { userId, email } = entry.actor;
  if (!userId) return "System";
  const person = people.find(
    (p) => p.id === userId || (email !== null && p.email.toLowerCase() === email.toLowerCase()),
  );
  return person?.name || email || "a removed user";
}

/** Notes and case changes in one list, newest first. */
export function CaseTimeline({
  notes,
  timeline,
  people,
}: {
  notes: AdminSupportNote[];
  timeline: AdminSupportTimelineEntry[];
  /** Admins whose names are known: the signed-in admin and the assignee. */
  people: AdminSupportPerson[];
}) {
  const known = [...people, ...notes.flatMap((note) => (note.author ? [note.author] : []))];
  const items: Item[] = [
    ...notes.map((note) => ({ kind: "note" as const, at: note.createdAt, id: note.id, note })),
    ...timeline.map((entry) => ({
      kind: "event" as const,
      at: entry.occurredAt,
      id: entry.id,
      entry,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (items.length === 0) return <EmptyState icon={History} title="Nothing here yet" />;
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="flex gap-3 px-4 py-3">
          {item.kind === "note" ? (
            <StickyNote aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          ) : (
            <History aria-hidden className="mt-0.5 size-4 shrink-0 text-sub" />
          )}
          <div className="min-w-0 flex-1">
            {item.kind === "note" ? (
              <>
                <p className="text-sm font-medium">
                  Note
                  <span className="font-normal text-sub">
                    {" by "}
                    {item.note.author?.name || item.note.author?.email || "a removed user"}
                  </span>
                </p>
                {/* Plain text only: React escapes it, and pre-wrap keeps the line breaks. */}
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{item.note.body}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {timelineActionLabels[item.entry.action] ?? item.entry.action}
                  <span className="font-normal break-all text-sub">
                    {" by "}
                    {actorName(item.entry, known)}
                  </span>
                </p>
                {changeLines(item.entry.changes).map((line) => (
                  <p key={line} className="text-sm">
                    {line}
                  </p>
                ))}
                {item.entry.reason && (
                  <p className="mt-0.5 text-sm break-words">
                    <span className="text-sub">Reason: </span>
                    {item.entry.reason}
                  </p>
                )}
              </>
            )}
            <p className="mt-1 text-xs text-sub">
              <time dateTime={item.at} title={formatInstant(item.at)}>
                {formatRelative(item.at)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
