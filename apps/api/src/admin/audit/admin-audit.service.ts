import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_AUDIT_PAGE_SIZE,
  type AdminAuditLogsQuery,
  type AdminAuditPage,
  type AdminAuditRow,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { iso, selectRows } from "../shared/admin-sql.js";
import { maskIpAddress } from "../users/session-display.js";

/** Rows about one account, whichever side they were recorded against. */
const ACCOUNT_TARGET_TYPES = ["account", "user"];
const RECENT_FOR_TARGET = 20;

/** A Nairobi calendar date (YYYY-MM-DD) as the instant its day starts. */
function nairobiDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+03:00`);
}

/** Read access to the append-only audit log. */
@Injectable()
export class AdminAuditService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  /**
   * The IP address is truncated like session addresses on every admin read. The table
   * keeps the full address for forensics; only direct database access sees it.
   */
  private async select(where: SQL, limit: number, offset = 0): Promise<AdminAuditRow[]> {
    const rows = await selectRows<AdminAuditRow>(
      this.connection.db,
      sql`
        select
          a.id,
          ${iso(sql`a.occurred_at`)} as "occurredAt",
          json_build_object('userId', a.actor_user_id, 'role', a.actor_role, 'email', u.email) as actor,
          a.action,
          json_build_object('type', a.target_type, 'id', a.target_id) as target,
          a.outcome, a.reason, a.changes,
          a.request_id as "requestId", a.ip_address as "ipAddress"
        from audit_logs a
        left join users u on u.id = a.actor_user_id
        where ${where}
        order by a.occurred_at desc, a.id desc
        limit ${limit} offset ${offset}
      `,
    );
    return rows.map((row) => ({ ...row, ipAddress: maskIpAddress(row.ipAddress) }));
  }

  /** The newest rows about this account or its user (the same id). */
  recentForAccount(id: string): Promise<AdminAuditRow[]> {
    return this.select(
      sql`a.target_type in (${sql.join(
        ACCOUNT_TARGET_TYPES.map((type) => sql`${type}`),
        sql`, `,
      )}) and a.target_id = ${id}`,
      RECENT_FOR_TARGET,
    );
  }

  async list(query: AdminAuditLogsQuery, now = new Date()): Promise<AdminAuditPage> {
    const conditions: SQL[] = [];
    if (query.action) conditions.push(sql`a.action = ${query.action}`);
    if (query.targetType) conditions.push(sql`a.target_type = ${query.targetType}`);
    if (query.targetId) conditions.push(sql`a.target_id = ${query.targetId}`);
    if (query.actorId) conditions.push(sql`a.actor_user_id = ${query.actorId}`);
    if (query.outcome) conditions.push(sql`a.outcome = ${query.outcome}`);
    if (query.from) {
      conditions.push(
        sql`a.occurred_at >= ${nairobiDayStart(query.from).toISOString()}::timestamptz`,
      );
    }
    if (query.to) {
      const end = new Date(nairobiDayStart(query.to).getTime() + 24 * 60 * 60 * 1000);
      conditions.push(sql`a.occurred_at < ${end.toISOString()}::timestamptz`);
    }
    const where = conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

    const [count] = await selectRows<{ total: number }>(
      this.connection.db,
      sql`select count(*)::int as total from audit_logs a where ${where}`,
    );
    return {
      page: query.page,
      pageSize: ADMIN_AUDIT_PAGE_SIZE,
      total: count!.total,
      entries: await this.select(
        where,
        ADMIN_AUDIT_PAGE_SIZE,
        (query.page - 1) * ADMIN_AUDIT_PAGE_SIZE,
      ),
      generatedAt: now.toISOString(),
    };
  }
}
