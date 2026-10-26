import { Inject, Injectable } from "@nestjs/common";
import type { AdminActivity, AdminActivityItem } from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { at, fromUtc, hasGoogle, iso, selectRows, utcAt } from "../shared/admin-sql.js";

/**
 * Admin actions taken from the audit log. Grants and limit overrides are read from their
 * own tables instead (they hold the facts), and payments from the payments table.
 */
const AUDIT_KINDS = {
  "tenant.end_pro": "pro_ended",
  "tenant.suspend": "account_suspended",
  "tenant.reactivate": "account_reactivated",
  "user.revoke_sessions": "sessions_revoked",
} as const;

const AUDIT_SUMMARIES = {
  pro_ended: "Pro was ended early",
  account_suspended: "Account was suspended",
  account_reactivated: "Account was reactivated",
  sessions_revoked: "All sessions were signed out",
} as const;

interface ActivityRow extends Omit<AdminActivityItem, "account" | "admin"> {
  accountId: string | null;
  accountName: string | null;
  adminId: string | null;
  adminName: string | null;
}

/** A merged, newest-first feed of what happened on the platform up to `now`, built from existing tables. */
@Injectable()
export class AdminActivityService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async activity(limit: number, now = new Date()): Promise<AdminActivity> {
    // Each source is cut to `limit` newest rows first, so the merge never reads whole tables.
    const source = (select: SQL, order: SQL) =>
      sql`(${select} order by ${order} desc limit ${limit})`;
    const columns = (
      id: SQL,
      kind: SQL,
      time: SQL,
      account: { id: SQL; name: SQL },
      summary: SQL,
      admin: { id: SQL; name: SQL } | null = null,
    ) => sql`select ${id} as id, ${kind} as kind, ${time} as at,
      ${account.id} as account_id, ${account.name} as account_name, ${summary} as summary,
      ${admin ? admin.id : sql`null::uuid`} as admin_id, ${admin ? admin.name : sql`null::text`} as admin_name`;

    const paidAt = sql`coalesce(sp.paid_at, sp.confirmed_at, sp.created_at)`;
    const money = sql`sp.currency || ' ' || sp.amount::text`;
    const rows = await selectRows<ActivityRow>(
      this.connection.db,
      sql`
      select e.id, e.kind, ${iso(sql`e.at`)} as at, e.account_id as "accountId",
        e.account_name as "accountName", e.summary, e.admin_id as "adminId", e.admin_name as "adminName"
      from (
        ${source(
          sql`${columns(
            sql`'signed_up:' || u.id`,
            sql`'signed_up'`,
            fromUtc(sql`u.created_at`),
            { id: sql`u.id`, name: sql`u.name` },
            sql`'Signed up with ' || case when ${hasGoogle(sql`u.id`)} then 'Google' else 'email' end`,
          )} from users u
            where u.created_at < ${utcAt(now)}`,
          sql`u.created_at`,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'first_invoice_ready:' || ii.id`,
            sql`'first_invoice_ready'`,
            sql`ii.issued_at`,
            { id: sql`u.id`, name: sql`u.name` },
            sql`'Made their first invoice Ready'`,
          )} from invoice_issuances ii join users u on u.id = ii.user_id
            where ii.issued_at < ${at(now)} and not exists (
              select 1 from invoice_issuances x where x.user_id = ii.user_id
                and (x.issued_at, x.id) < (ii.issued_at, ii.id)
            )`,
          sql`ii.issued_at`,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'pro_payment:' || sp.id`,
            sql`'pro_payment'`,
            paidAt,
            { id: sql`u.id`, name: sql`u.name` },
            sql`'Pro payment of ' || ${money} || case when sp.provider = 'manual'
              then ' recorded by hand (' || replace(sp.method, '_', ' ') || ')' else ' by M-Pesa' end`,
            { id: sql`rb.id`, name: sql`rb.name` },
          )} from subscription_payments sp join users u on u.id = sp.user_id
            left join users rb on rb.id = sp.recorded_by
            where sp.status = 'succeeded' and sp.purpose = 'pro_month' and ${paidAt} < ${at(now)}`,
          paidAt,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'credit_pack:' || sp.id`,
            sql`'credit_pack'`,
            paidAt,
            { id: sql`u.id`, name: sql`u.name` },
            sql`'Bought ' || sp.credits_granted || ' invoice credits for ' || ${money} || case
              when sp.provider = 'manual' then ' (recorded by hand)' else '' end`,
            { id: sql`rb.id`, name: sql`rb.name` },
          )} from subscription_payments sp join users u on u.id = sp.user_id
            left join users rb on rb.id = sp.recorded_by
            where sp.status = 'succeeded' and sp.purpose = 'invoice_credits'
              and ${paidAt} < ${at(now)}`,
          paidAt,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'mpesa_failed:' || sp.id`,
            sql`'mpesa_failed'`,
            sql`sp.created_at`,
            { id: sql`u.id`, name: sql`u.name` },
            sql`'M-Pesa payment of ' || ${money} || ' failed'`,
          )} from subscription_payments sp join users u on u.id = sp.user_id
            where sp.status = 'failed' and sp.provider <> 'manual' and sp.created_at < ${at(now)}`,
          sql`sp.created_at`,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'grant_given:' || g.id`,
            sql`'grant_given'`,
            sql`g.created_at`,
            { id: sql`u.id`, name: sql`u.name` },
            sql`'Gave ' || g.quantity || case when g.kind = 'pro_months'
              then ' Pro month' || case when g.quantity = 1 then '' else 's' end
              else ' invoice credits' end`,
            { id: sql`a.id`, name: sql`a.name` },
          )} from account_grants g join users u on u.id = g.user_id
            left join users a on a.id = g.granted_by
            where g.created_at < ${at(now)}`,
          sql`g.created_at`,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'override_added:' || o.id`,
            sql`'override_added'`,
            sql`o.created_at`,
            { id: sql`u.id`, name: sql`u.name` },
            sql`'Raised the invoice limit by ' || o.extra_invoices || ' until '
              || to_char(o.expires_at at time zone 'Africa/Nairobi', 'YYYY-MM-DD')`,
            { id: sql`a.id`, name: sql`a.name` },
          )} from allowance_overrides o join users u on u.id = o.user_id
            left join users a on a.id = o.created_by
            where o.created_at < ${at(now)}`,
          sql`o.created_at`,
        )}
        union all
        ${source(
          sql`${columns(
            sql`'audit:' || al.id`,
            sql`case al.action ${sql.join(
              Object.entries(AUDIT_KINDS).map(([action, kind]) => sql`when ${action} then ${kind}`),
              sql` `,
            )} end`,
            sql`al.occurred_at`,
            { id: sql`u.id`, name: sql`u.name` },
            sql`case al.action ${sql.join(
              Object.entries(AUDIT_KINDS).map(
                ([action, kind]) => sql`when ${action} then ${AUDIT_SUMMARIES[kind]}`,
              ),
              sql` `,
            )} end`,
            { id: sql`a.id`, name: sql`a.name` },
          )} from audit_logs al join users u on u.id::text = al.target_id
            left join users a on a.id = al.actor_user_id
            where al.outcome = 'success' and al.occurred_at < ${at(now)}
              and al.action in (${sql.join(
                Object.keys(AUDIT_KINDS).map((action) => sql`${action}`),
                sql`, `,
              )})`,
          sql`al.occurred_at`,
        )}
      ) e
      order by e.at desc, e.id desc
      limit ${limit}
    `,
    );

    return {
      items: rows.map(({ accountId, accountName, adminId, adminName, ...item }) => ({
        ...item,
        account: accountId ? { id: accountId, name: accountName ?? "" } : null,
        admin: adminId ? { id: adminId, name: adminName ?? "" } : null,
      })),
      generatedAt: now.toISOString(),
    };
  }
}
