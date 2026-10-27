import { type SQL, sql } from "@billsafi/db";
import { at } from "../shared/admin-sql.js";
import { windowEndSql } from "../shared/account-sql.js";

/**
 * The accounts with Pro access at instant `t`, as a CTE named `name` with `user_id` and
 * `source` ("paid" or "complimentary") columns. Past Pro is rebuilt from the windows that
 * paid for it (succeeded Pro payments and Pro gifts, cut short when an admin ended Pro),
 * because `subscriptions.anchor_at` is overwritten when a lapsed account starts a new run.
 * The stored run (anchor <= t < paid_until) is added for Pro that has no window row, such
 * as accounts set up before windows were recorded. The source is that of the latest
 * window covering `t`, and "paid" when only the stored run covers it.
 */
export function proAccessCte(name: string, t: Date): SQL {
  const covering = sql.identifier(`${name}_covering`);
  const window = (alias: string) => sql`
    ${sql.raw(alias)}.granted_from <= ${at(t)} and ${windowEndSql(sql.raw(alias))} > ${at(t)}`;
  return sql`
    ${covering} as (
      select sp.user_id, 'paid' as source, coalesce(sp.confirmed_at, sp.created_at) as added_at
      from subscription_payments sp
      where sp.status = 'succeeded' and sp.purpose = 'pro_month' and ${window("sp")}
      union all
      select g.user_id, 'complimentary', g.created_at
      from account_grants g
      where g.kind = 'pro_months' and ${window("g")}
    ),
    ${sql.identifier(name)} as (
      select p.user_id, coalesce(src.source, 'paid') as source
      from (
        select user_id from ${covering}
        union
        select s.user_id from subscriptions s where s.anchor_at <= ${at(t)} and s.paid_until > ${at(t)}
      ) p
      left join (
        select distinct on (c.user_id) c.user_id, c.source
        from ${covering} c order by c.user_id, c.added_at desc
      ) src on src.user_id = p.user_id
    )`;
}
