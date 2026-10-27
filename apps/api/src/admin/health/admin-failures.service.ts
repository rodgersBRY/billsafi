import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ACTIVITY_PAGE_SIZE,
  type AdminFailureRow,
  type AdminFailuresPage,
  type AdminFailuresQuery,
} from "@billsafi/contracts";
import { type DatabaseConnection, sql } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { at, DAY_MS, iso, selectRows } from "../shared/admin-sql.js";

/** The short list behind the Health page's PDF and email indicator (D066). */
@Injectable()
export class AdminFailuresService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async failures(query: AdminFailuresQuery, now = new Date()): Promise<AdminFailuresPage> {
    const db = this.connection.db;
    const where = query.kind ? sql`f.kind = ${query.kind}` : sql`true`;
    const items = await selectRows<AdminFailureRow>(
      db,
      sql`
        select f.id, ${iso(sql`f.created_at`)} as "occurredAt", f.kind, f.operation,
          case when u.id is null then null
            else json_build_object('id', u.id, 'name', u.name) end as account,
          f.error_class as "errorClass", f.message
        from operation_failures f left join users u on u.id = f.account_id
        where ${where}
        order by f.created_at desc, f.id desc
        limit ${ADMIN_ACTIVITY_PAGE_SIZE} offset ${(query.page - 1) * ADMIN_ACTIVITY_PAGE_SIZE}
      `,
    );
    const [totals] = await selectRows<{ total: number; pdf: number; email: number; job: number }>(
      db,
      sql`
        select (count(*) filter (where ${where}))::int as total,
          (count(*) filter (where kind = 'pdf' and created_at >= ${at(new Date(now.getTime() - DAY_MS))}))::int as pdf,
          (count(*) filter (where kind = 'email' and created_at >= ${at(new Date(now.getTime() - DAY_MS))}))::int as email,
          (count(*) filter (where kind = 'job' and created_at >= ${at(new Date(now.getTime() - DAY_MS))}))::int as job
        from operation_failures f
      `,
    );
    return {
      page: query.page,
      pageSize: ADMIN_ACTIVITY_PAGE_SIZE,
      total: totals!.total,
      items,
      last24h: { pdf: totals!.pdf, email: totals!.email, job: totals!.job },
      generatedAt: now.toISOString(),
    };
  }
}
