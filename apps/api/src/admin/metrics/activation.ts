import { type Database, type SQL, sql } from "@billsafi/db";
import { DAY_MS, fromUtc, selectRows, utcAt } from "../shared/admin-sql.js";

/** Sign-ups get this long after signing up to make an invoice Ready. */
export const ACTIVATION_DAYS = 7;

/**
 * Activation for sign-ups in [from, to): `base` is those who signed up at least 7 days
 * before `now` (younger ones have not had their week yet), `activated` those among them
 * with an invoice made Ready within 7 days of signing up.
 */
export async function activationCounts(
  db: Database,
  from: Date,
  to: Date,
  now: Date,
): Promise<{ activated: number; base: number }> {
  const oldEnough = new Date(now.getTime() - ACTIVATION_DAYS * DAY_MS);
  const cohort: SQL = sql`u.created_at >= ${utcAt(from)} and u.created_at < ${utcAt(to)}
    and u.created_at <= ${utcAt(oldEnough)}`;
  const [row] = await selectRows<{ activated: number; base: number }>(
    db,
    sql`
      select
        count(*)::int as base,
        count(*) filter (where exists (
          select 1 from invoice_issuances ii
          where ii.user_id = u.id and ii.issued_at >= ${fromUtc(sql`u.created_at`)}
            and ii.issued_at < ${fromUtc(sql`u.created_at`)}
              + make_interval(hours => ${24 * ACTIVATION_DAYS})
        ))::int as activated
      from users u where ${cohort}
    `,
  );
  return row!;
}
