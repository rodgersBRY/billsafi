import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Unsubscribe links carry the user ID and an HMAC of it, so they work without signing in
 * and can't be forged for someone else. The key is derived from the auth secret with a
 * fixed label, so the same secret never signs two kinds of thing.
 */

const LABEL = "billsafi:reengagement-unsubscribe:v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function signature(secret: string, userId: string): string {
  const key = createHmac("sha256", secret).update(LABEL).digest();
  return createHmac("sha256", key).update(userId).digest("base64url");
}

export function unsubscribeToken(secret: string, userId: string): string {
  return `${userId}.${signature(secret, userId)}`;
}

/** The user ID the token was made for, or null when it is malformed or forged. */
export function verifyUnsubscribeToken(secret: string, token: string): string | null {
  const [userId, given, extra] = token.split(".");
  if (!userId || !given || extra !== undefined || !UUID.test(userId)) return null;
  const expected = Buffer.from(signature(secret, userId));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return userId;
}
