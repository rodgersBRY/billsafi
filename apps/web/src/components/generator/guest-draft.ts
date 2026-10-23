import type { ImportGuestInvoiceInput } from "@billsafi/contracts";

/** Exactly the import body, so the finish page can post it without converting. */
export type GuestDraft = ImportGuestInvoiceInput;

const KEY = "billsafi:guest-invoice:v1";
const VERSION = 1;

// Storage throws in private mode or when blocked; the page must work without it.
export function readGuestDraft(): GuestDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    if (
      typeof stored !== "object" ||
      stored === null ||
      (stored as { version?: unknown }).version !== VERSION
    ) {
      return null;
    }
    const draft = (stored as { draft?: unknown }).draft;
    return typeof draft === "object" && draft !== null ? (draft as GuestDraft) : null;
  } catch {
    return null;
  }
}

export function writeGuestDraft(draft: GuestDraft): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, draft }));
  } catch {
    // Keep going without storage.
  }
}

export function clearGuestDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
