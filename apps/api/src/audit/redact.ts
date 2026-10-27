import { maskPhone } from "@billsafi/domain";

/** Key words whose values never belong in an audit row, matched as whole words. */
const SECRET_WORDS = new Set([
  "password",
  "passwd",
  "pass",
  "pwd",
  "passkey",
  "passphrase",
  "token",
  "secret",
  "authorization",
  "auth",
  "cookie",
  "credential",
  "credentials",
  "otp",
  "pin",
  "signature",
  "hash",
  "jwt",
]);
/** "key" alone is too broad (idempotency_key is useful), so only these pairs count. */
const SECRET_KEY_PREFIXES = new Set([
  "api",
  "private",
  "secret",
  "access",
  "consumer",
  "signing",
  "encryption",
]);
const PHONE_WORDS = new Set(["phone", "msisdn", "mobile"]);
/** Stored E.164 numbers and the Kenyan local forms people type. */
const PHONE_VALUE = /^(?:\+[1-9]\d{7,14}|(?:254|0)[17]\d{8})$/;

export const MAX_DEPTH = 8;
export const MAX_CHANGES_BYTES = 16 * 1024;

/** "clientSecret", "refresh_token", "X-Api-Key" -> ["client","secret"], ["refresh","token"], ... */
export function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSecretKey(key: string): boolean {
  const words = keyWords(key);
  return words.some(
    (word, index) =>
      SECRET_WORDS.has(word) ||
      (word === "key" && index > 0 && SECRET_KEY_PREFIXES.has(words[index - 1]!)),
  );
}

function isPhoneKey(key: string | undefined): boolean {
  return key !== undefined && keyWords(key).some((word) => PHONE_WORDS.has(word));
}

function maskIfPhone(value: string, phoneKey: boolean): string {
  const digits = value.replace(/\D/g, "").length;
  if (phoneKey && digits >= 7) return maskPhone(value);
  if (PHONE_VALUE.test(value.replace(/[\s()-]/g, ""))) return maskPhone(value);
  return value;
}

function walk(
  value: unknown,
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value && typeof value === "object") {
    // Dates and similar objects describe themselves; use that form like JSON would.
    const own = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof own === "function") return walk(own.call(value), key, depth, seen);
    if (depth >= MAX_DEPTH) return "[truncated]";
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const result = Array.isArray(value)
      ? value.map((item) => walk(item, key, depth + 1, seen))
      : Object.fromEntries(
          Object.entries(value)
            .filter(([name]) => !isSecretKey(name))
            .map(([name, item]) => [name, walk(item, name, depth + 1, seen)]),
        );
    seen.delete(value);
    return result;
  }
  if (typeof value === "string") return maskIfPhone(value, isPhoneKey(key));
  if (typeof value === "number" && isPhoneKey(key) && String(value).length >= 7) {
    return maskPhone(String(value));
  }
  return value;
}

/**
 * Copies a value for the audit log: drops secret-named keys at any depth and masks phone
 * numbers. Over-redacting is fine here; leaking a token into append-only history is not.
 */
export function redact(value: unknown): unknown {
  return walk(value, undefined, 0, new WeakSet());
}

/** redact(), then a size cap so one huge diff cannot bloat the log. */
export function redactChanges(value: unknown): unknown {
  const redacted = redact(value);
  const size = Buffer.byteLength(JSON.stringify(redacted) ?? "null");
  return size > MAX_CHANGES_BYTES ? { truncated: true } : redacted;
}
