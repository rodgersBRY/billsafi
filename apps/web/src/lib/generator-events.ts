import { ANONYMOUS_ID_STORAGE_KEY, type GeneratorEventName } from "@billsafi/contracts";

/*
 * The free generator's anonymous events (D066). A random id in this browser's storage ties the
 * steps of one visitor together. Sending is fire and forget: it never waits, never throws and
 * never touches the UI.
 */

/** Used for this visit when storage is blocked. */
let memoryId: string | null = null;
let startedSent = false;

export function getAnonymousId(): string {
  try {
    const stored = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);
    if (stored && UUID.test(stored)) return stored;
    const id = crypto.randomUUID();
    window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, id);
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sendGeneratorEvent(name: GeneratorEventName): void {
  try {
    void fetch("/api/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, anonymousId: getAnonymousId() }),
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // Recording is never allowed to break the page.
  }
}

/** The first edit of a visit, once. */
export function sendGeneratorStarted(): void {
  if (startedSent) return;
  startedSent = true;
  sendGeneratorEvent("generator_started");
}
