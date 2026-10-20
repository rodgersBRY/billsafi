import { normalizeKenyanPhone } from "@billsafi/domain";
import { z } from "zod";

/** Accepts 07…, 01…, 254… or +254… and outputs +254XXXXXXXXX (D047). */
export const kenyanPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a Kenyan mobile number, like 0712 345 678" });
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
