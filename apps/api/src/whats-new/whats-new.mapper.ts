import type { AdminWhatsNewEntry, WhatsNewEntry, WhatsNewLinkSegment } from "@billsafi/contracts";
import type { schema } from "@billsafi/db";
import { isWhatsNewUnread, whatsNewStatus } from "@billsafi/domain";

type EntryRow = typeof schema.whatsNewEntries.$inferSelect;

/** A live entry for a user. Only call it with rows that have a publish time. */
export function toWhatsNewEntry(row: EntryRow, seenSince: Date): WhatsNewEntry {
  const publishedAt = row.publishedAt!;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    linkSegment: row.linkSegment as WhatsNewLinkSegment | null,
    pro: row.pro,
    publishedAt: publishedAt.toISOString(),
    unread: isWhatsNewUnread(publishedAt, seenSince),
  };
}

export function toAdminWhatsNewEntry(row: EntryRow, now: Date): AdminWhatsNewEntry {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    linkSegment: row.linkSegment as WhatsNewLinkSegment | null,
    pro: row.pro,
    popup: row.popup,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    status: whatsNewStatus(row.publishedAt, now),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
