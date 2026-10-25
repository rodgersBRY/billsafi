import type { AdminGrantRow } from "@billsafi/contracts";
import { type SQL, sql } from "@billsafi/db";
import type { Executor } from "../database/transaction.js";
import { windowEndSql } from "./account-sql.js";
import { iso } from "./admin-sql.js";

interface GrantSqlRow extends Omit<AdminGrantRow, "grantedBy"> {
  grantedById: string;
  grantedByEmail: string | null;
}

/** Grant rows as `account_grants g`, filtered by `where`, newest first. */
export async function selectGrants(
  db: Executor,
  where: SQL,
  page?: { limit: number; offset: number },
): Promise<AdminGrantRow[]> {
  const { rows } = await db.execute(sql`
    select
      g.id, g.user_id as "userId", u.email as "userEmail", g.kind, g.quantity, g.reason,
      g.granted_by as "grantedById", gb.email as "grantedByEmail",
      ${iso(sql`g.granted_from`)} as "grantedFrom",
      ${iso(windowEndSql(sql`g`))} as "grantedUntil",
      coalesce(g.ended_early_at < g.granted_until, false) as "endedEarly",
      ${iso(sql`g.created_at`)} as "createdAt"
    from account_grants g
    join users u on u.id = g.user_id
    left join users gb on gb.id = g.granted_by
    where ${where}
    order by g.created_at desc, g.id desc
    ${page ? sql`limit ${page.limit} offset ${page.offset}` : sql``}
  `);
  return (rows as unknown as GrantSqlRow[]).map(({ grantedById, grantedByEmail, ...row }) => ({
    ...row,
    grantedBy: { id: grantedById, email: grantedByEmail },
  }));
}
