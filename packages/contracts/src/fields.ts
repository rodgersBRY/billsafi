import { normalizeKenyanPhone, normalizePhone } from "@billsafi/domain";
import { z } from "zod";

/** Any phone number with a country code, or a local 07…/01… mobile (D058). Outputs E.164. */
export const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a phone number with its country code, like +44 20 7946 0958",
      });
      return z.NEVER;
    }
    return normalized;
  });

/** M-Pesa numbers: 07…, 01…, 254… or +254…, output as +254XXXXXXXXX (D047). */
export const mpesaPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter an M-Pesa number, like 0712 345 678" });
      return z.NEVER;
    }
    return normalized;
  });

export const requiredText = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

/** Optional text: blank input becomes null so cleared fields are stored as empty. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((value) => (value === "" ? null : value))
    .nullish();
