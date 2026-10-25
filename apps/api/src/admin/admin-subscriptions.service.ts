import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_GRANTS_PAGE_SIZE,
  ADMIN_OVERRIDES_PAGE_SIZE,
  ADMIN_PLAN_PAYMENTS_PAGE_SIZE,
  ADMIN_SUBSCRIPTIONS_PAGE_SIZE,
  type AdminAccountStatus,
  type AdminCurrentMonthSource,
  type AdminGrantsPage,
  type AdminGrantsQuery,
  type AdminOverridesPage,
  type AdminOverridesQuery,
  type AdminPlanPaymentsPage,
  type AdminPlanPaymentsQuery,
  type AdminSubscriptionRow,
  type AdminSubscriptionSort,
  type AdminSubscriptionsPage,
  type AdminSubscriptionsQuery,
  type AdminSubscriptionStatus,
  type ManualPaymentCurrency,
  type PlanPaymentProvider,
} from "@billsafi/contracts";
import { and, type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";
import {
  accountStatusSql,
  activeOverrideSql,
  creditsSql,
  currentMonthSourceSql,
  proAccessSql,
  subscriptionStatusSql,
} from "./account-sql.js";
import { selectGrants } from "./admin-grants.js";
import { overrideStateSql, selectOverrides } from "./admin-overrides.js";
import { planPaymentColumns, toAdminPlanPayment } from "./admin-payments.js";
import {
  at,
  DAY_MS,
  FREE_ADMIN_PLAN,
  fromUtc,
  isUuid,
  iso,
  proPlan,
  selectRows,
} from "./admin-sql.js";

const { subscriptionPayments, users } = schema;

/** A Nairobi calendar date (YYYY-MM-DD) as the instant its day starts. */
function dayStart(date: string): Date {
  return new Date(`${date}T00:00:00+03:00`);
}

/** created_at within the Nairobi days `from` to `to`, both inclusive. */
function inDays(column: SQL, query: { from?: string; to?: string }): SQL[] {
  const conditions: SQL[] = [];
  if (query.from) conditions.push(sql`${column} >= ${at(dayStart(query.from))}`);
  if (query.to)
    conditions.push(sql`${column} < ${at(new Date(dayStart(query.to).getTime() + DAY_MS))}`);
  return conditions;
}

/** Matches the account's email (and name where given), or its exact id. */
function accountSearch(search: string, email: SQL, id: SQL, name?: SQL): SQL {
  const pattern = containsPattern(search);
  const matches = [sql`${email} ilike ${pattern}`];
  if (name) matches.push(sql`${name} ilike ${pattern}`);
  if (isUuid(search)) matches.push(sql`${id} = ${search}::uuid`);
  return sql`(${sql.join(matches, sql` or `)})`;
}

const all = (conditions: SQL[]) =>
  conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

const offset = (page: number, size: number) => (page - 1) * size;

interface SubscriptionSqlRow {
  id: string;
  name: string;
  email: string;
  accountStatus: AdminAccountStatus;
  subscriptionStatus: AdminSubscriptionStatus;
  proUntil: string | null;
  cancelledAt: string | null;
  currentMonthSource: AdminCurrentMonthSource | null;
  lastPaymentAt: string | null;
  lastPaymentAmount: string | null;
  lastPaymentCurrency: ManualPaymentCurrency | null;
  lastPaymentProvider: string | null;
  credits: number;
  overrideCount: number;
  overrideExtra: number;
  registeredAt: string;
}

const SUBSCRIPTION_SORTS: Record<AdminSubscriptionSort, SQL> = {
  registered: sql`r.registered_at`,
  proUntil: sql`r.paid_until`,
  lastPayment: sql`r.last_payment_at`,
  name: sql`lower(r.name)`,
};

/**
 * Read-only lists for the admin Subscriptions module: accounts with their plan, all plan
 * payments, grants and limit overrides. Pro facts come from subscriptions.paid_until and
 * the shared SQL in account-sql.ts, so they agree with the tenants directory.
 */
@Injectable()
export class AdminSubscriptionsService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  /** Every account as `rows r`, with the facts the directory filters and sorts on. */
  private subscriptionsCte(now: Date): SQL {
    return sql`
      with base as (
        select u.id, u.name, u.email, u.banned, ${fromUtc(sql`u.created_at`)} as registered_at,
          s.anchor_at, s.paid_until, s.cancelled_at,
          ${proAccessSql(sql`s.anchor_at`, sql`s.paid_until`, now)} as pro_access
        from users u
        left join subscriptions s on s.user_id = u.id
      ),
      rows as (
        select b.*,
          ${accountStatusSql(sql`b.banned`)} as account_status,
          ${subscriptionStatusSql(sql`b.pro_access`, sql`b.paid_until`, now)} as subscription_status,
          ${currentMonthSourceSql(sql`b.id`, sql`b.pro_access`, now)} as current_month_source,
          lp.paid_at as last_payment_at, lp.amount as last_payment_amount,
          lp.currency as last_payment_currency, lp.provider as last_payment_provider,
          ${creditsSql(sql`b.id`)} as credits,
          ov.count as override_count, ov.extra as override_extra
        from base b
        left join lateral (
          select coalesce(sp.paid_at, sp.confirmed_at) as paid_at, sp.amount, sp.currency, sp.provider
          from subscription_payments sp
          where sp.user_id = b.id and sp.status = 'succeeded'
          order by coalesce(sp.paid_at, sp.confirmed_at) desc, sp.id desc
          limit 1
        ) lp on true
        cross join lateral (
          select count(*)::int as count, coalesce(sum(o.extra_invoices), 0)::int as extra
          from allowance_overrides o
          where o.user_id = b.id and ${activeOverrideSql(sql`o`, now)}
        ) ov
      )
    `;
  }

  private subscriptionsWhere(query: AdminSubscriptionsQuery, now: Date): SQL {
    const conditions: SQL[] = [];
    if (query.search) {
      conditions.push(accountSearch(query.search, sql`r.email`, sql`r.id`, sql`r.name`));
    }
    if (query.subscriptionStatus) {
      conditions.push(sql`r.subscription_status = ${query.subscriptionStatus}`);
    }
    if (query.renewalWithin) {
      conditions.push(
        sql`r.pro_access and r.paid_until <= ${at(now)} + make_interval(hours => ${24 * query.renewalWithin})`,
      );
    }
    if (query.lapsedWithin) {
      conditions.push(
        sql`r.paid_until <= ${at(now)} and r.paid_until > ${at(now)} - make_interval(hours => ${24 * query.lapsedWithin})`,
      );
    }
    if (query.hasOverride !== undefined) {
      conditions.push(query.hasOverride ? sql`r.override_count > 0` : sql`r.override_count = 0`);
    }
    return all(conditions);
  }

  async subscriptions(
    query: AdminSubscriptionsQuery,
    now = new Date(),
  ): Promise<AdminSubscriptionsPage> {
    const where = this.subscriptionsWhere(query, now);
    const [count] = await selectRows<{ total: number }>(
      this.db,
      sql`${this.subscriptionsCte(now)} select count(*)::int as total from rows r where ${where}`,
    );
    const direction = query.dir === "asc" ? sql`asc` : sql`desc`;
    const rows = await selectRows<SubscriptionSqlRow>(
      this.db,
      sql`
        ${this.subscriptionsCte(now)}
        select r.id, r.name, r.email, r.account_status as "accountStatus",
          r.subscription_status as "subscriptionStatus",
          ${iso(sql`r.paid_until`)} as "proUntil", ${iso(sql`r.cancelled_at`)} as "cancelledAt",
          r.current_month_source as "currentMonthSource",
          ${iso(sql`r.last_payment_at`)} as "lastPaymentAt",
          r.last_payment_amount as "lastPaymentAmount",
          r.last_payment_currency as "lastPaymentCurrency",
          r.last_payment_provider as "lastPaymentProvider",
          r.credits, r.override_count as "overrideCount", r.override_extra as "overrideExtra",
          ${iso(sql`r.registered_at`)} as "registeredAt"
        from rows r
        where ${where}
        order by ${SUBSCRIPTION_SORTS[query.sort]} ${direction} nulls last, r.id ${direction}
        limit ${ADMIN_SUBSCRIPTIONS_PAGE_SIZE}
        offset ${offset(query.page, ADMIN_SUBSCRIPTIONS_PAGE_SIZE)}
      `,
    );
    return {
      page: query.page,
      pageSize: ADMIN_SUBSCRIPTIONS_PAGE_SIZE,
      total: count!.total,
      subscriptions: rows.map(toSubscriptionRow),
      generatedAt: now.toISOString(),
    };
  }

  /** Who paid for the current Pro month, for one account (tenant detail). */
  async currentMonthSource(id: string, now = new Date()): Promise<AdminCurrentMonthSource | null> {
    const [row] = await selectRows<{ source: AdminCurrentMonthSource | null }>(
      this.db,
      sql`select ${currentMonthSourceSql(
        sql`s.user_id`,
        proAccessSql(sql`s.anchor_at`, sql`s.paid_until`, now),
        now,
      )} as source from subscriptions s where s.user_id = ${id}`,
    );
    return row?.source ?? null;
  }

  async payments(query: AdminPlanPaymentsQuery, now = new Date()): Promise<AdminPlanPaymentsPage> {
    const conditions: SQL[] = [...inDays(sql`${subscriptionPayments.createdAt}`, query)];
    if (query.search) {
      conditions.push(
        accountSearch(query.search, sql`${users.email}`, sql`${subscriptionPayments.userId}`),
      );
    }
    if (query.provider) {
      conditions.push(
        query.provider === "manual"
          ? sql`${subscriptionPayments.provider} = ${schema.MANUAL_PROVIDER}`
          : sql`${subscriptionPayments.provider} <> ${schema.MANUAL_PROVIDER}`,
      );
    }
    if (query.status) conditions.push(eq(subscriptionPayments.status, query.status)!);
    if (query.method) conditions.push(eq(subscriptionPayments.method, query.method)!);
    const where = and(...conditions);

    const [count] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(subscriptionPayments)
      .innerJoin(users, eq(users.id, subscriptionPayments.userId))
      .where(where);
    const rows = await this.db
      .select(planPaymentColumns)
      .from(subscriptionPayments)
      .innerJoin(users, eq(users.id, subscriptionPayments.userId))
      .where(where)
      .orderBy(desc(subscriptionPayments.createdAt), desc(subscriptionPayments.id))
      .limit(ADMIN_PLAN_PAYMENTS_PAGE_SIZE)
      .offset(offset(query.page, ADMIN_PLAN_PAYMENTS_PAGE_SIZE));
    return {
      page: query.page,
      pageSize: ADMIN_PLAN_PAYMENTS_PAGE_SIZE,
      total: count!.total,
      payments: rows.map(toAdminPlanPayment),
      generatedAt: now.toISOString(),
    };
  }

  async grants(query: AdminGrantsQuery, now = new Date()): Promise<AdminGrantsPage> {
    const conditions: SQL[] = [...inDays(sql`g.created_at`, query)];
    if (query.kind) conditions.push(sql`g.kind = ${query.kind}`);
    if (query.search) conditions.push(accountSearch(query.search, sql`u.email`, sql`g.user_id`));
    const where = all(conditions);
    const [count] = await selectRows<{ total: number }>(
      this.db,
      sql`select count(*)::int as total from account_grants g join users u on u.id = g.user_id
        where ${where}`,
    );
    return {
      page: query.page,
      pageSize: ADMIN_GRANTS_PAGE_SIZE,
      total: count!.total,
      grants: await selectGrants(this.db, where, {
        limit: ADMIN_GRANTS_PAGE_SIZE,
        offset: offset(query.page, ADMIN_GRANTS_PAGE_SIZE),
      }),
      generatedAt: now.toISOString(),
    };
  }

  async overrides(query: AdminOverridesQuery, now = new Date()): Promise<AdminOverridesPage> {
    const conditions: SQL[] = [];
    if (query.state) conditions.push(sql`${overrideStateSql(now)} = ${query.state}`);
    if (query.search) conditions.push(accountSearch(query.search, sql`u.email`, sql`o.user_id`));
    const where = all(conditions);
    const [count] = await selectRows<{ total: number }>(
      this.db,
      sql`select count(*)::int as total from allowance_overrides o join users u on u.id = o.user_id
        where ${where}`,
    );
    return {
      page: query.page,
      pageSize: ADMIN_OVERRIDES_PAGE_SIZE,
      total: count!.total,
      overrides: await selectOverrides(this.db, now, where, {
        limit: ADMIN_OVERRIDES_PAGE_SIZE,
        offset: offset(query.page, ADMIN_OVERRIDES_PAGE_SIZE),
      }),
      generatedAt: now.toISOString(),
    };
  }
}

function toSubscriptionRow(row: SubscriptionSqlRow): AdminSubscriptionRow {
  const pro = row.subscriptionStatus === "pro" || row.subscriptionStatus === "pro_ending";
  return {
    id: row.id,
    owner: { name: row.name, email: row.email },
    accountStatus: row.accountStatus,
    plan: pro ? proPlan(row.proUntil!) : FREE_ADMIN_PLAN,
    subscriptionStatus: row.subscriptionStatus,
    proUntil: row.proUntil,
    cancelledAt: row.cancelledAt,
    currentMonthSource: row.currentMonthSource,
    lastPayment: row.lastPaymentAt
      ? {
          date: row.lastPaymentAt,
          amount: row.lastPaymentAmount!,
          currency: row.lastPaymentCurrency!,
          provider: (row.lastPaymentProvider === schema.MANUAL_PROVIDER
            ? "manual"
            : "mpesa") as PlanPaymentProvider,
        }
      : null,
    credits: row.credits,
    activeOverrides: { count: row.overrideCount, extraInvoices: row.overrideExtra },
    registeredAt: row.registeredAt,
  };
}
