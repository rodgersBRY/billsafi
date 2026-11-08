/** Matches whatsNewStatuses in contracts. */
export type WhatsNewEntryStatus = "draft" | "scheduled" | "live";

export function whatsNewStatus(publishedAt: Date | null, now: Date): WhatsNewEntryStatus {
  if (!publishedAt) return "draft";
  return publishedAt.getTime() > now.getTime() ? "scheduled" : "live";
}

/** A user who never opened the panel counts as having seen everything before sign-up. */
export function whatsNewSeenSince(seenAt: Date | null, signedUpAt: Date): Date {
  return seenAt ?? signedUpAt;
}

/** For a live entry: published after the user last looked. */
export function isWhatsNewUnread(publishedAt: Date, seenSince: Date): boolean {
  return publishedAt.getTime() > seenSince.getTime();
}

/** Open the panel by itself when a flagged entry is unread, but never over the first-run tour. */
export function shouldPopUpWhatsNew(
  liveEntries: { publishedAt: Date; popup: boolean }[],
  seenSince: Date,
  firstRunTourDue: boolean,
): boolean {
  if (firstRunTourDue) return false;
  return liveEntries.some((entry) => entry.popup && isWhatsNewUnread(entry.publishedAt, seenSince));
}
