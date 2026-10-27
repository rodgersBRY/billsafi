import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ACTIVITY_PAGE_SIZE,
  type AdminFailedSignInRow,
  type AdminFailedSignInsPage,
  type AdminFailedSignInsQuery,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { containsPattern } from "../../common/like-pattern.js";
import { DATABASE } from "../../database/database.module.js";
import { at, DAY_MS, iso, selectRows } from "../shared/admin-sql.js";
import { planRange } from "../metrics/range.js";

const TOP_LIMIT = 5;

/** Failed sign-ins for the Security tab (D066): a filtered page and a 24 hour and 7 day summary. */
@Injectable()
export class AdminFailedSignInsService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async list(query: AdminFailedSignInsQuery, now = new Date()): Promise<AdminFailedSignInsPage> {
    const db = this.connection.db;
    const plan = planRange(query.range, now);
    const conditions: SQL[] = [
      sql`f.created_at >= ${at(plan.start)}`,
      sql`f.created_at <= ${at(now)}`,
    ];
    if (query.email) conditions.push(sql`f.email ilike ${containsPattern(query.email)}`);
    if (query.method) conditions.push(sql`f.method = ${query.method}`);
    if (query.reason) conditions.push(sql`f.reason = ${query.reason}`);
    const where = sql.join(conditions, sql` and `);

    const items = await selectRows<AdminFailedSignInRow>(
      db,
      sql`
        select f.id, ${iso(sql`f.created_at`)} as "occurredAt", f.email, f.method, f.reason,
          f.ip_masked as "ipMasked"
        from failed_sign_ins f where ${where}
        order by f.created_at desc, f.id desc
        limit ${ADMIN_ACTIVITY_PAGE_SIZE} offset ${(query.page - 1) * ADMIN_ACTIVITY_PAGE_SIZE}
      `,
    );
    const [total] = await selectRows<{ total: number }>(
      db,
      sql`select count(*)::int as total from failed_sign_ins f where ${where}`,
    );

    const day = at(new Date(now.getTime() - DAY_MS));
    const [counts] = await selectRows<{ last24h: number; last7d: number }>(
      db,
      sql`
        select (count(*) filter (where created_at >= ${day}))::int as "last24h",
          count(*)::int as "last7d"
        from failed_sign_ins
        where created_at >= ${at(new Date(now.getTime() - 7 * DAY_MS))} and created_at <= ${at(now)}
      `,
    );
    const topEmails = await selectRows<{ email: string; count: number }>(
      db,
      sql`
        select email, count(*)::int as count from failed_sign_ins
        where email is not null and created_at >= ${day} and created_at <= ${at(now)}
        group by email order by count(*) desc, email limit ${TOP_LIMIT}
      `,
    );
    const topIps = await selectRows<{ ipMasked: string; count: number }>(
      db,
      sql`
        select ip_masked as "ipMasked", count(*)::int as count from failed_sign_ins
        where ip_masked is not null and created_at >= ${day} and created_at <= ${at(now)}
        group by ip_masked order by count(*) desc, ip_masked limit ${TOP_LIMIT}
      `,
    );
    return {
      page: query.page,
      pageSize: ADMIN_ACTIVITY_PAGE_SIZE,
      total: total!.total,
      items,
      summary: {
        last24h: counts!.last24h,
        last7d: counts!.last7d,
        topEmails: topEmails.map((row) => ({ email: row.email, count: Number(row.count) })),
        topIps: topIps.map((row) => ({ ipMasked: row.ipMasked, count: Number(row.count) })),
      },
      generatedAt: now.toISOString(),
    };
  }
}
