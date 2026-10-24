import { maskPhone } from "@billsafi/domain";

/** Keys whose values never belong in an audit row, at any depth. */
const SECRET_KEY = /pass|token|secret|key|authorization|cookie/i;
const PHONE_KEY = /phone|msisdn/i;
/** Stored E.164 numbers and the Kenyan local forms people type. */
const PHONE_VALUE = /^(?:\+[1-9]\d{7,14}|(?:254|0)[17]\d{8})$/;

function looksLikePhone(value: string): boolean {
  return PHONE_VALUE.test(value.replace(/[\s()-]/g, ""));
}

/**
 * Copies a value for the audit log: drops secret-looking keys and masks phone numbers.
 * Over-redacting is fine here; leaking a token into append-only history is not.
 */
export function redact(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([name]) => !SECRET_KEY.test(name))
        .map(([name, item]) => [name, redact(item, name)]),
    );
  }
  const phoneKey = key !== undefined && PHONE_KEY.test(key);
  if (typeof value === "string" && (phoneKey || looksLikePhone(value))) return maskPhone(value);
  if (typeof value === "number" && phoneKey) return maskPhone(String(value));
  return value;
}
