import type { ImportGuestInvoiceInput } from "@billsafi/contracts";

/** Exactly the import body, so the finish page can post it without converting. */
export type GuestDraft = ImportGuestInvoiceInput;

const KEY = "billsafi:guest-invoice:v1";
const VERSION = 1;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Structural check only: half-finished drafts must still load, so no schema parse here.
function isDraftShape(draft: unknown): draft is GuestDraft {
  return (
    isObject(draft) &&
    isObject(draft.business) &&
    isObject(draft.client) &&
    isObject(draft.invoice) &&
    Array.isArray(draft.invoice.items)
  );
}

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
    return isDraftShape(draft) ? draft : null;
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
