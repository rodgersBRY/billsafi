const MESSAGE_LIMIT = 300;

/**
 * Failure messages are kept so the owner can see what went wrong, but never a value that
 * came from a user or a query (D066). Drizzle errors carry the SQL and its parameters, pg
 * errors quote the offending value, and SMTP errors repeat the recipient, so:
 * everything from "params:" on is cut, a "Failed query" message becomes a fixed sentence,
 * quoted text and key values are replaced, then addresses, links, phone numbers and long
 * token-like strings.
 */
export function sanitizeMessage(text: string): string {
  const beforeParams = text.split(/\r?\n\s*params:/i)[0] ?? "";
  const withoutSql = /^\s*Failed query:/i.test(beforeParams)
    ? "Database query failed"
    : beforeParams;
  return withoutSql
    .replace(/'[^']*'/g, "[value]")
    .replace(/"[^"]*"/g, "[value]")
    .replace(/Key \([^)]*\)=\([^)]*\)/gi, "Key [value]")
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
