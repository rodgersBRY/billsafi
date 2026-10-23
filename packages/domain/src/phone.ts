/**
 * Kenyan mobile numbers (D047): 07XX/01XX local, 254 or +254 international.
 * Stored as +2547XXXXXXXX or +2541XXXXXXXX. M-Pesa numbers must match this.
 */
const KENYAN_MOBILE = /^(?:\+?254|0)?([71]\d{8})$/;

/** E.164: a plus, a country code that does not start with 0, and 8 to 15 digits in all. */
const INTERNATIONAL = /^\+([1-9]\d{7,14})$/;

function compact(input: string): string {
  return input.replace(/[\s\-().]/g, "");
}

export function normalizeKenyanPhone(input: string): string | null {
  const match = KENYAN_MOBILE.exec(compact(input));
  return match ? `+254${match[1]}` : null;
}

export function formatKenyanPhone(stored: string): string {
  const local = stored.slice(4);
  return `+254 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * Any phone number (D058). Numbers with a country code (+ or 00) are kept as
 * typed; local 07XX/01XX numbers are still read as Kenyan mobiles so existing
 * users can keep typing them. Stored in E.164 form, such as +447946095800.
 */
export function normalizePhone(input: string): string | null {
  const kenyan = normalizeKenyanPhone(input);
  if (kenyan) return kenyan;
  const value = compact(input).replace(/^00/, "+");
  const match = INTERNATIONAL.exec(value);
  return match ? `+${match[1]}` : null;
}

/** Groups Kenyan mobiles for display; other numbers are shown as stored. */
export function formatPhone(stored: string): string {
  return KENYAN_MOBILE.test(stored) ? formatKenyanPhone(stored) : stored;
}

/** The number to put in an input for editing: Kenyan mobiles as 07XX XXX XXX. */
export function editablePhone(stored: string): string {
  if (!KENYAN_MOBILE.test(stored)) return stored;
  const local = `0${stored.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
