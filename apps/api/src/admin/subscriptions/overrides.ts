import type { AdminOverrideRow, AdminOverrideState } from "@billsafi/contracts";
import { type SQL, sql } from "@billsafi/db";
import type { Executor } from "../../database/transaction.js";
import { at, iso } from "../shared/admin-sql.js";

/** An override's state at `now`, the same rule AllowanceService uses to count it. */
export function overrideStateSql(now: Date): SQL<AdminOverrideState> {
  return sql<AdminOverrideState>`(case
    when o.revoked_at is not null then 'revoked'
    when o.expires_at <= ${at(now)} then 'expired'
    when o.starts_at > ${at(now)} then 'scheduled'
    else 'active'
  end)`;
}

interface OverrideSqlRow extends Omit<AdminOverrideRow, "createdBy" | "revokedBy"> {
  createdById: string;
  createdByEmail: string | null;
  revokedById: string | null;
  revokedByEmail: string | null;
}

/** Override rows as `allowance_overrides o`, filtered by `where`, newest first. */
export async function selectOverrides(
  db: Executor,
  now: Date,
  where: SQL,
  page?: { limit: number; offset: number },
): Promise<AdminOverrideRow[]> {
  const { rows } = await db.execute(sql`
    select
      o.id, o.user_id as "userId", u.email as "userEmail", o.extra_invoices as "extraInvoices",
      ${iso(sql`o.starts_at`)} as "startsAt", ${iso(sql`o.expires_at`)} as "expiresAt",
      ${overrideStateSql(now)} as state, o.reason, ${iso(sql`o.created_at`)} as "createdAt",
      o.created_by as "createdById", cb.email as "createdByEmail",
      ${iso(sql`o.revoked_at`)} as "revokedAt",
      o.revoked_by as "revokedById", rb.email as "revokedByEmail",
      o.revoke_reason as "revokeReason"
    from allowance_overrides o
    join users u on u.id = o.user_id
    left join users cb on cb.id = o.created_by
    left join users rb on rb.id = o.revoked_by
    where ${where}
    order by o.created_at desc, o.id desc
    ${page ? sql`limit ${page.limit} offset ${page.offset}` : sql``}
  `);
  return (rows as unknown as OverrideSqlRow[]).map(
    ({ createdById, createdByEmail, revokedById, revokedByEmail, ...row }) => ({
      ...row,
      createdBy: { id: createdById, email: createdByEmail },
      revokedBy: revokedById ? { id: revokedById, email: revokedByEmail } : null,
    }),
  );
}
