import {
  type PlatformSettingKey,
  platformSettingDefaults,
  platformSettingSchemas,
  type PlatformSettingValues,
} from "@billsafi/contracts";
import { type Database, eq, schema } from "@billsafi/db";

/**
 * Parses a stored value, falling back to the default when it is missing or no longer valid
 * (say, a schema tightened after it was saved). Falling back keeps sign-up and the public
 * page working; the admin page shows the default as the value in force.
 */
export function parseSetting<K extends PlatformSettingKey>(
  key: K,
  stored: unknown,
): PlatformSettingValues[K] {
  if (stored === undefined || stored === null) return platformSettingDefaults[key];
  const parsed = platformSettingSchemas[key].safeParse(stored);
  return parsed.success ? (parsed.data as PlatformSettingValues[K]) : platformSettingDefaults[key];
}

/** Reads one setting fresh from the table. Used where a stale answer would be wrong. */
export async function readSetting<K extends PlatformSettingKey>(
  db: Database,
  key: K,
): Promise<PlatformSettingValues[K]> {
  const [row] = await db
    .select({ value: schema.platformSettings.value })
    .from(schema.platformSettings)
    .where(eq(schema.platformSettings.key, key));
  return parseSetting(key, row?.value);
}

/**
 * Registration for the sign-up hook. A missing row is the default (open), but a row that is
 * there and no longer validates counts as closed: failing open would let sign-ups through
 * on a value nobody can read. The warning says so in the API log.
 */
export async function readRegistrationForEnforcement(
  db: Database,
): Promise<PlatformSettingValues["registration"]> {
  const [row] = await db
    .select({ value: schema.platformSettings.value })
    .from(schema.platformSettings)
    .where(eq(schema.platformSettings.key, "registration"));
  if (!row) return platformSettingDefaults.registration;
  const parsed = platformSettingSchemas.registration.safeParse(row.value);
  if (parsed.success) return parsed.data;
  console.warn(
    "The stored registration setting is not valid; treating registration as closed until it is saved again.",
  );
  return { open: false, closedMessage: platformSettingDefaults.registration.closedMessage };
}
