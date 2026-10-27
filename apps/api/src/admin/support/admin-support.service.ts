import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ADMIN_SUPPORT_PAGE_SIZE,
  type AdminSupportAccount,
  type AdminSupportCaseDetail,
  type AdminSupportCaseRow,
  type AdminSupportCasesPage,
  type AdminSupportCasesQuery,
  type AdminSupportDiagnostics,
  type AdminSupportNote,
  type AdminSupportTimelineEntry,
  SUPPORT_RECENT_DAYS,
} from "@billsafi/contracts";
import { type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { stuckPaymentCutoff } from "@billsafi/domain";
import { containsPattern } from "../../common/like-pattern.js";
import { DATABASE } from "../../database/database.module.js";
import { AdminAuditService } from "../audit/admin-audit.service.js";
import { at, DAY_MS, isUuid, iso, selectRows } from "../shared/admin-sql.js";
import { planPaymentColumns, toAdminPlanPayment } from "../subscriptions/payments.js";
import { AdminTenantsService } from "../tenants/admin-tenants.service.js";

const { subscriptionPayments, users } = schema;

const SEVERITY_RANK = sql`case c.severity when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 else 1 end`;
const SORTS: Record<AdminSupportCasesQuery["sort"], SQL> = {
  updated: sql`c.updated_at`,
  created: sql`c.created_at`,
  severity: SEVERITY_RANK,
};
/** Case actions that belong on a case's timeline (notes are listed on their own). */
const TIMELINE_ACTIONS = [
  "support.case_create",
  "support.case_update",
  "support.case_resolve",
  "support.case_reopen",
];
const ACCOUNT_LIST_CAP = 100;

const person = (alias: string, id: string) => sql`
  case when ${sql.raw(alias)}.id is null then null else json_build_object(
    'id', ${sql.raw(alias)}.id, 'name', ${sql.raw(alias)}.name, 'email', ${sql.raw(alias)}.email
  ) end as ${sql.raw(`"${id}"`)}`;

/** The case row query pieces, shared by the list, one case and the account tab. */
const CASE_FROM = sql`
  from support_cases c
  join users u on u.id = c.account_id
  left join users asg on asg.id = c.assigned_to
  left join users cb on cb.id = c.created_by`;
const CASE_COLUMNS = sql`
  c.id, c.account_id as "accountId",
  json_build_object('name', u.name, 'email', u.email) as account,
  c.title, c.category, c.severity, c.status,
  ${person("asg", "assignedTo")}, ${person("cb", "createdBy")},
  ${iso(sql`c.created_at`)} as "createdAt", ${iso(sql`c.updated_at`)} as "updatedAt",
  ${iso(sql`c.resolved_at`)} as "resolvedAt", c.resolution,
  (select count(*) from support_notes n where n.case_id = c.id)::int as "noteCount"`;
const NOTE_SELECT = sql`
  select n.id, n.case_id as "caseId", n.account_id as "accountId",
    case when au.id is null then null else json_build_object(
      'id', au.id, 'name', au.name, 'email', au.email) end as author,
    n.body, ${iso(sql`n.created_at`)} as "createdAt"
  from support_notes n left join users au on au.id = n.author_id`;

/** Read side of the admin Support module. */
@Injectable()
export class AdminSupportService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly tenants: AdminTenantsService,
    private readonly audit: AdminAuditService,
  ) {}

  private rows<T>(query: SQL) {
    return selectRows<T>(this.connection.db, query);
  }

  private where(query: AdminSupportCasesQuery, now: Date): SQL {
    const conditions: SQL[] = [];
    if (query.tab === "recent") {
      conditions.push(
        sql`c.updated_at >= ${at(new Date(now.getTime() - SUPPORT_RECENT_DAYS * DAY_MS))}`,
      );
    } else if (query.tab) {
      conditions.push(sql`c.status = ${query.tab}`);
    }
    if (query.status) conditions.push(sql`c.status = ${query.status}`);
    if (query.severity) conditions.push(sql`c.severity = ${query.severity}`);
    if (query.category) conditions.push(sql`c.category = ${query.category}`);
    if (query.accountId) conditions.push(sql`c.account_id = ${query.accountId}::uuid`);
    if (query.search) {
      const pattern = containsPattern(query.search);
      const matches = [
        sql`c.title ilike ${pattern}`,
        sql`u.name ilike ${pattern}`,
        sql`u.email ilike ${pattern}`,
      ];
      if (isUuid(query.search)) {
        matches.push(sql`c.id = ${query.search}::uuid`, sql`c.account_id = ${query.search}::uuid`);
      }
      conditions.push(sql`(${sql.join(matches, sql` or `)})`);
    }
    return conditions.length ? sql.join(conditions, sql` and `) : sql`true`;
  }

  async list(query: AdminSupportCasesQuery, now = new Date()): Promise<AdminSupportCasesPage> {
    const where = this.where(query, now);
    const [count] = await this.rows<{ total: number }>(
      sql`select count(*)::int as total ${CASE_FROM} where ${where}`,
    );
    const direction = query.dir === "asc" ? sql`asc` : sql`desc`;
    const cases = await this.rows<AdminSupportCaseRow>(sql`
      select ${CASE_COLUMNS} ${CASE_FROM}
      where ${where}
      order by ${SORTS[query.sort]} ${direction}, c.updated_at desc, c.id desc
      limit ${ADMIN_SUPPORT_PAGE_SIZE} offset ${(query.page - 1) * ADMIN_SUPPORT_PAGE_SIZE}
    `);
    return {
      page: query.page,
      pageSize: ADMIN_SUPPORT_PAGE_SIZE,
      total: count!.total,
      cases,
      generatedAt: now.toISOString(),
    };
  }

  /** One case row, fresh; 404 when unknown. */
  async caseRow(id: string): Promise<AdminSupportCaseRow> {
    const [row] = await this.rows<AdminSupportCaseRow>(
      sql`select ${CASE_COLUMNS} ${CASE_FROM} where c.id = ${id}`,
    );
    if (!row) throw new NotFoundException("Case not found");
    return row;
  }

  async detail(id: string, now = new Date()): Promise<AdminSupportCaseDetail> {
    const row = await this.caseRow(id);
    const notes = await this.rows<AdminSupportNote>(
      sql`${NOTE_SELECT} where n.case_id = ${id} order by n.created_at, n.id`,
    );
    const timeline = await this.rows<AdminSupportTimelineEntry>(sql`
      select a.id, ${iso(sql`a.occurred_at`)} as "occurredAt", a.action,
        json_build_object('userId', a.actor_user_id, 'email', u.email) as actor,
        a.reason, a.changes
      from audit_logs a left join users u on u.id = a.actor_user_id
      where a.outcome = 'success'
        and a.action in (${sql.join(
          TIMELINE_ACTIONS.map((action) => sql`${action}`),
          sql`, `,
        )})
        and ((a.target_type = 'support_case' and a.target_id = ${id})
          or (a.action = 'support.case_create' and a.changes ->> 'caseId' = ${id}))
      order by a.occurred_at, a.id
    `);
    return {
      case: row,
      notes,
      timeline,
      diagnostics: await this.diagnostics(row.accountId, now),
      generatedAt: now.toISOString(),
    };
  }

  /** Facts about the account from queries the tenant page already uses. */
  private async diagnostics(accountId: string, now: Date): Promise<AdminSupportDiagnostics> {
    const tenant = await this.tenants.summary(accountId, now);
    const [last] = await this.connection.db
      .select(planPaymentColumns)
      .from(subscriptionPayments)
      .innerJoin(users, eq(users.id, subscriptionPayments.userId))
      .where(eq(subscriptionPayments.userId, accountId))
      .orderBy(desc(subscriptionPayments.createdAt), desc(subscriptionPayments.id))
      .limit(1);
    const [stuck] = await this.rows<{ total: number }>(sql`
      select count(*)::int as total from subscription_payments
      where user_id = ${accountId} and status = 'pending'
        and created_at < ${at(stuckPaymentCutoff(now))}`);
    return {
      subscription: { status: tenant.subscriptionStatus, plan: tenant.plan },
      lastPayment: last ? toAdminPlanPayment(last) : null,
      stuckPayments: stuck!.total,
      recentActions: (await this.audit.recentForAccount(accountId)).slice(0, 5),
    };
  }

  /** A case's account cases and loose notes, for the tenant page's Support tab. */
  async forAccount(accountId: string, now = new Date()): Promise<AdminSupportAccount> {
    const [account] = await this.connection.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, accountId));
    if (!account) throw new NotFoundException("Account not found");
    const cases = await this.rows<AdminSupportCaseRow>(sql`
      select ${CASE_COLUMNS} ${CASE_FROM}
      where c.account_id = ${accountId} order by c.updated_at desc, c.id desc
      limit ${ACCOUNT_LIST_CAP}`);
    const notes = await this.rows<AdminSupportNote>(sql`
      ${NOTE_SELECT} where n.account_id = ${accountId} and n.case_id is null
      order by n.created_at desc, n.id desc limit ${ACCOUNT_LIST_CAP}`);
    return { accountId, cases, notes, generatedAt: now.toISOString() };
  }
}
