const MESSAGE_LIMIT = 300;

/**
 * Failure messages are kept so the owner can see what went wrong, but never an address,
 * link, token or phone number (D066). Anything that looks like one is replaced.
 */
export function sanitizeMessage(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+/g, "[email]")
    .replace(/\+?\d[\d ()-]{7,}\d/g, "[number]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGE_LIMIT);
}

/** The error's class name, such as "Error" or "AggregateError"; never its message. */
export function errorClassOf(error: unknown): string {
  if (error instanceof Error) {
    const name = error.constructor?.name || error.name;
    return (name || "Error").slice(0, 80);
  }
  return typeof error;
}

export function errorMessageOf(error: unknown): string {
  return sanitizeMessage(error instanceof Error ? error.message : String(error));
}
