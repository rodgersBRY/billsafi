/** New accounts (email or Google sign-up) pass through /welcome before entering the app. */
export const WELCOME_PATH = "/welcome";

/** The welcome screen URL that continues on to `next` once the user agrees. */
export function welcomePath(next: string): string {
  return `${WELCOME_PATH}?next=${encodeURIComponent(next)}`;
}

/** Same-origin paths only, so the welcome screen can't be used as an open redirect. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
