/**
 * Kenyan mobile numbers only (D047): 07XX/01XX local, 254 or +254 international.
 * Stored as +2547XXXXXXXX or +2541XXXXXXXX.
 */
const KENYAN_MOBILE = /^(?:\+?254|0)?([71]\d{8})$/;

export function normalizeKenyanPhone(input: string): string | null {
  const compact = input.replace(/[\s\-()]/g, "");
  const match = KENYAN_MOBILE.exec(compact);
  return match ? `+254${match[1]}` : null;
}

export function formatKenyanPhone(stored: string): string {
  const local = stored.slice(4);
  return `+254 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
