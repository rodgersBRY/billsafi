/** Shown when Better Auth's admin plugin refuses a sign-in because the account is suspended. */
export const SUSPENDED_ACCOUNT_MESSAGE =
  "This account is suspended. Contact support if you think this is a mistake.";

/**
 * The plugin answers email sign-in with the code BANNED_USER and sends Google sign-ins
 * back with ?error=BANNED_USER (some versions lower-case it, or use "banned").
 */
export function isBannedError(code: string | null | undefined): boolean {
  if (!code) return false;
  const normalized = code.toUpperCase();
  return normalized === "BANNED_USER" || normalized === "BANNED";
}
