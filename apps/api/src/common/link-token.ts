import { createHash, randomBytes } from "node:crypto";

/** 256 random bits, base64url. Shown once; only the hash is stored (D026). */
export function newLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Rejects malformed tokens before any database lookup. */
export function isLinkToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
