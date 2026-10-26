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
