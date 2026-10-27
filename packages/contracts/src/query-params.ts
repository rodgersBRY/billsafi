import { z } from "zod";

/* Query-string helpers shared by the admin list schemas. Not exported from the package. */

/** Query strings arrive as text; an empty value (a cleared filter) means "not set". */
export const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const searchParam = z
  .string()
  .trim()
  .max(100)
  .transform((value) => value || undefined)
  .optional();
export const pageParam = z.coerce.number().int().min(1).max(10_000).default(1);
export const sortDirParam = z.preprocess(blankToUndefined, z.enum(["asc", "desc"]).default("desc"));
export const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());
export const optionalDays = <const T extends readonly [number, ...number[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.coerce.number().pipe(z.literal(values)).optional());

export const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().min(1).max(max).optional());
/** A Nairobi calendar date, YYYY-MM-DD. */
export const optionalDate = z.preprocess(blankToUndefined, z.iso.date().optional());
