import type { AdminPlan, AdminRole, AdminSignInMethod } from "@billsafi/contracts";
import { type Database, type SQL, sql } from "@billsafi/db";
import { addNairobiMonths, proPeriodAt } from "@billsafi/domain";

/*
 * Shared SQL pieces for the admin queries. Better Auth tables (users,
 * sessions, accounts) store UTC in `timestamp without time zone`, while app
 * tables use timestamptz, so the helpers below convert explicitly.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** An instant as a timestamptz parameter. */
export function at(instant: Date): SQL {
  return sql`${instant.toISOString()}::timestamptz`;
}

/** An instant as a UTC `timestamp` parameter, to compare with Better Auth columns on their index. */
export function utcAt(instant: Date): SQL {
  return sql`(${instant.toISOString()}::timestamptz at time zone 'UTC')`;
}

/** A Better Auth `timestamp` column read as the UTC instant it holds. */
export function fromUtc(column: SQL): SQL {
  return sql`(${column} at time zone 'UTC')`;
}

/**
 * When a plan payment was paid: the day an admin says a manual payment was paid, else the
 * confirmation. Every succeeded row has a confirmed_at (billing and the manual action both
 * set it), so this is never null for them. Collected money, the activity feed, "bought
 * within 14 days" and "paid within 30 days" all use this one rule. `alias` is the table alias.
 */
export function paidOnSql(alias: string): SQL {
  return sql`coalesce(${sql.raw(alias)}.paid_at, ${sql.raw(alias)}.confirmed_at)`;
}

/** A timestamptz expression as an ISO string, so rows need no date parsing. */
export function iso(expr: SQL): SQL<string> {
  return sql<string>`to_char(${expr} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

/** True when the user has any Google login; such users count as Google signups. */
export function hasGoogle(userId: SQL): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from accounts a where a.user_id = ${userId} and a.provider_id = 'google'
  )`;
}

/** Better Auth provider ids as admin sign-in methods: "credential" is email and password. */
export function signInMethods(providerIds: string[] | null): AdminSignInMethod[] {
  const methods = new Set<AdminSignInMethod>();
  for (const id of providerIds ?? []) {
    if (id === "credential") methods.add("email");
    if (id === "google") methods.add("google");
  }
  return [...methods].sort();
}

/** Pro while `proPeriodAt` finds a paid period, the one Pro rule the app uses everywhere. */
export function planAt(anchorAt: Date | null, paidMonths: number, now: Date): AdminPlan {
  if (anchorAt && proPeriodAt(anchorAt, paidMonths, now)) {
    return proPlan(addNairobiMonths(anchorAt, paidMonths).toISOString());
  }
  return FREE_ADMIN_PLAN;
}

export const FREE_ADMIN_PLAN: AdminPlan = { code: "free", label: "Free", proUntil: null };

export function proPlan(proUntil: string): AdminPlan {
  return { code: "pro", label: "Pro", proUntil };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lets a search box match an exact id as well as text. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** users.role is free text in the plugin schema; anything but "admin" is a plain user. */
export function toAdminRole(role: string): AdminRole {
  return role === "admin" ? "admin" : "user";
}

/** A ratio rounded to 4 places, or null when there is nothing to divide by. */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : null;
}

/** Runs a raw admin query and returns its rows typed as `T`. */
export async function selectRows<T>(db: Database, query: SQL): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}
