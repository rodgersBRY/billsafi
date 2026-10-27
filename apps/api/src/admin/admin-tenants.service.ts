import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ADMIN_TENANTS_PAGE_SIZE,
  type AdminAccountStatus,
  type AdminLifecycleStage,
  type AdminSubscriptionStatus,
  type AdminTenantBusiness,
  type AdminTenantDetail,
  type AdminTenantPayment,
  type AdminTenantRow,
  type AdminTenantSort,
  type AdminTenantsPage,
  type AdminTenantsQuery,
  invoiceStatuses,
  type InvoiceStatus,
} from "@billsafi/contracts";
import { type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { maskPhone } from "@billsafi/domain";
import { AllowanceService } from "../billing/allowance.service.js";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";
import {
  accountStatusSql,
  lastMeaningfulActivitySql,
  lifecycleStageSql,
  proAccessSql,
  proEndsAtSql,
  subscriptionStatusSql,
} from "./account-sql.js";
import { AdminAuditService } from "./admin-audit.service.js";
import {
  at,
  DAY_MS,
  FREE_ADMIN_PLAN,
  fromUtc,
  isUuid,
  iso,
  proPlan,
  selectRows,
  signInMethods,
  toAdminRole,
} from "./admin-sql.js";

const { subscriptionPayments } = schema;

const RECENT_PAYMENTS = 10;

/** One row of the `tenants` CTE, already formatted for the response. */
interface TenantRowData {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  banReason: string | null;
  registeredAt: string;
  anchorAt: string | null;
  paidMonths: number;
  proEndsAt: string | null;
  cancelledAt: string | null;
  businessCount: number;
  firstBusinessName: string | null;
  readyInvoices: number;
  lastActivityAt: string | null;
  accountStatus: AdminAccountStatus;
  subscriptionStatus: AdminSubscriptionStatus;
  lifecycleStage: AdminLifecycleStage;
}

const SORT_COLUMNS: Record<AdminTenantSort, SQL> = {
  registered: sql`t.registered_at`,
  lastActivity: sql`t.last_activity_at`,
  readyInvoices: sql`t.ready_invoices`,
  name: sql`lower(t.name)`,
};

/** Read-only tenant (account) directory and tenant detail. */
@Injectable()
export class AdminTenantsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly allowance: AllowanceService,
    private readonly audit: AdminAuditService,
  ) {}

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.connection.db, query);
  }

  /**
   * Every account with its raw facts and the three statuses, as `tenants t`. The statuses
   * come from account-sql.ts so filters, sorting and the shown badges always agree.
   */
  private tenantsCte(now: Date): SQL {
    return sql`
      with facts as (
        select
          u.id, u.name, u.email, u.email_verified, u.role, u.banned, u.ban_reason,
          ${fromUtc(sql`u.created_at`)} as registered_at,
          s.anchor_at, coalesce(s.paid_months, 0) as paid_months, s.cancelled_at,
          ${proEndsAtSql(sql`s.anchor_at`, sql`s.paid_months`)} as pro_ends_at,
          b.business_count, b.first_business_name,
          (select count(*) from invoice_issuances ii where ii.user_id = u.id)::int as ready_invoices,
          ${lastMeaningfulActivitySql(sql`u.id`)} as last_activity_at
        from users u
        left join subscriptions s on s.user_id = u.id
        cross join lateral (
          select count(*)::int as business_count,
            (array_agg(bx.display_name order by bx.created_at, bx.id))[1] as first_business_name
          from businesses bx where bx.owner_user_id = u.id
        ) b
      ),
      with_access as (
        select f.*, ${proAccessSql(sql`f.anchor_at`, sql`f.pro_ends_at`, now)} as pro_access
        from facts f
      ),
      tenants as (
        select w.*,
          ${accountStatusSql(sql`w.banned`)} as account_status,
          ${subscriptionStatusSql(sql`w.pro_access`, sql`w.pro_ends_at`, now)} as subscription_status,
          ${lifecycleStageSql(
            {
              proAccess: sql`w.pro_access`,
              businesses: sql`w.business_count`,
              readyInvoices: sql`w.ready_invoices`,
              lastActivityAt: sql`w.last_activity_at`,
            },
            now,
          )} as lifecycle_stage
        from with_access w
      )
    `;
  }

  private readonly columns = sql`
    t.id, t.name, t.email, t.email_verified as "emailVerified", t.role, t.ban_reason as "banReason",
    ${iso(sql`t.registered_at`)} as "registeredAt",
    ${iso(sql`t.anchor_at`)} as "anchorAt", t.paid_months as "paidMonths",
    ${iso(sql`t.pro_ends_at`)} as "proEndsAt", ${iso(sql`t.cancelled_at`)} as "cancelledAt",
    t.business_count as "businessCount", t.first_business_name as "firstBusinessName",
    t.ready_invoices as "readyInvoices", ${iso(sql`t.last_activity_at`)} as "lastActivityAt",
    t.account_status as "accountStatus", t.subscription_status as "subscriptionStatus",
    t.lifecycle_stage as "lifecycleStage"
  `;

  private where(query: AdminTenantsQuery, now: Date): SQL {
    const conditions: SQL[] = [];
    if (query.search) {
      const pattern = containsPattern(query.search);
      const matches = [
        sql`t.name ilike ${pattern}`,
        sql`t.email ilike ${pattern}`,
        sql`exists (select 1 from businesses bs
          where bs.owner_user_id = t.id and bs.display_name ilike ${pattern})`,
      ];
      if (isUuid(query.search)) matches.push(sql`t.id = ${query.search}::uuid`);
      conditions.push(sql`(${sql.join(matches, sql` or `)})`);
    }
    if (query.accountStatus) conditions.push(sql`t.account_status = ${query.accountStatus}`);
    if (query.subscriptionStatus) {
      conditions.push(sql`t.subscription_status = ${query.subscriptionStatus}`);
    }
    if (query.lifecycle) conditions.push(sql`t.lifecycle_stage = ${query.lifecycle}`);
    const daysAgo = (days: number) => at(new Date(now.getTime() - days * DAY_MS));
    if (query.signedUp) conditions.push(sql`t.registered_at >= ${daysAgo(query.signedUp)}`);
    if (query.activeWithin) {
      conditions.push(sql`t.last_activity_at >= ${daysAgo(query.activeWithin)}`);
    }
    if (query.inactiveFor) {
      conditions.push(
        sql`(t.last_activity_at is null or t.last_activity_at < ${daysAgo(query.inactiveFor)})`,
      );
    }
    return conditions.length ? sql.join(conditions, sql` and `) : sql`true`;
  }

  private toRow(row: TenantRowData): AdminTenantRow {
    const pro = row.subscriptionStatus === "pro" || row.subscriptionStatus === "pro_ending";
    return {
      id: row.id,
      owner: { name: row.name, email: row.email },
      role: toAdminRole(row.role),
      businesses: { firstName: row.firstBusinessName, count: row.businessCount },
      plan: pro ? proPlan(row.proEndsAt!) : FREE_ADMIN_PLAN,
      accountStatus: row.accountStatus,
      subscriptionStatus: row.subscriptionStatus,
      lifecycleStage: row.lifecycleStage,
      registeredAt: row.registeredAt,
      lastMeaningfulActivityAt: row.lastActivityAt,
      readyInvoices: row.readyInvoices,
    };
  }

  /** 25 tenants per page, filtered and sorted in SQL. */
  async list(query: AdminTenantsQuery, now = new Date()): Promise<AdminTenantsPage> {
    const where = this.where(query, now);
    const [count] = await this.rows<{ total: number }>(
      sql`${this.tenantsCte(now)} select count(*)::int as total from tenants t where ${where}`,
    );
    const direction = query.dir === "asc" ? sql`asc` : sql`desc`;
    const rows = await this.rows<TenantRowData>(sql`
      ${this.tenantsCte(now)}
      select ${this.columns} from tenants t
      where ${where}
      order by ${SORT_COLUMNS[query.sort]} ${direction} nulls last, t.id ${direction}
      limit ${ADMIN_TENANTS_PAGE_SIZE} offset ${(query.page - 1) * ADMIN_TENANTS_PAGE_SIZE}
    `);
    return {
      page: query.page,
      pageSize: ADMIN_TENANTS_PAGE_SIZE,
      total: count!.total,
      tenants: rows.map((row) => this.toRow(row)),
      generatedAt: now.toISOString(),
    };
  }

  private async findRow(id: string, now: Date): Promise<TenantRowData> {
    const [row] = await this.rows<TenantRowData>(
      sql`${this.tenantsCte(now)} select ${this.columns} from tenants t where t.id = ${id}`,
    );
    if (!row) throw new NotFoundException("Tenant not found");
    return row;
  }

  /** One directory row, fresh; used after an action. */
  async summary(id: string, now = new Date()): Promise<AdminTenantRow> {
    return this.toRow(await this.findRow(id, now));
  }

  async detail(id: string, now = new Date()): Promise<AdminTenantDetail> {
    const row = await this.findRow(id, now);

    const [providers] = await this.rows<{ ids: string[] | null }>(
      sql`select array_agg(distinct provider_id) as ids from accounts where user_id = ${id}`,
    );

    const businesses = await this.rows<
      Omit<AdminTenantBusiness, "invoices"> & {
        invoices: Partial<Record<InvoiceStatus, number>> | null;
      }
    >(sql`
      select
        b.id, b.display_name as "displayName", b.profile_type as "profileType",
        ${iso(sql`b.created_at`)} as "createdAt", b.contact_email as "contactEmail", b.phone,
        (select count(*) from clients c where c.business_id = b.id)::int as clients,
        (select json_object_agg(status, n) from (
          select i.status, count(*)::int as n from invoices i
          where i.business_id = b.id group by i.status
        ) by_status) as invoices,
        b.logo_key is not null as "hasLogo",
        (select octet_length(lg.data) from business_logos lg
          where lg.business_id = b.id and lg.id::text = b.logo_key)::int as "logoBytes"
      from businesses b
      where b.owner_user_id = ${id}
      order by b.created_at, b.id
    `);

    const [counts] = await this.rows<Omit<AdminTenantDetail["usage"], "allowance" | "credits">>(sql`
      with owned as (select id from businesses where owner_user_id = ${id})
      select
        (select count(*) from invoices where business_id in (select id from owned))::int
          as "invoicesCreated",
        (select count(*) from invoice_issuances where user_id = ${id})::int as "invoicesReady",
        (select count(*) from clients where business_id in (select id from owned))::int as clients,
        (select count(*) from invoice_links where business_id in (select id from owned))::int
          as "shareLinks",
        (select count(*) from invoice_payments
          where business_id in (select id from owned) and reversed_at is null)::int
          as "paymentsRecorded",
        (select coalesce(sum(octet_length(data)), 0) from business_logos
          where business_id in (select id from owned))::int as "storageBytes"
    `);

    const allowance = await this.allowance.usage(id, now);

    const payments = await this.connection.db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.userId, id))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(RECENT_PAYMENTS);

    const tenant = this.toRow(row);
    return {
      tenant,
      identity: {
        emailVerified: row.emailVerified,
        role: toAdminRole(row.role),
        signInMethods: signInMethods(providers?.ids ?? null),
        suspendedReason: row.accountStatus === "suspended" ? row.banReason : null,
      },
      businesses: businesses.map((business) => ({
        ...business,
        phone: maskPhone(business.phone),
        invoices: Object.fromEntries(
          invoiceStatuses.map((status) => [status, business.invoices?.[status] ?? 0]),
        ) as Record<InvoiceStatus, number>,
      })),
      usage: {
        allowance: {
          plan: allowance.plan,
          used: allowance.used,
          limit: allowance.limit,
          periodStart: allowance.periodStart,
          periodEnd: allowance.periodEnd,
        },
        credits: allowance.credits,
        ...counts!,
      },
      subscription: {
        plan: tenant.plan,
        status: tenant.subscriptionStatus,
        anchorAt: row.anchorAt,
        paidMonths: row.paidMonths,
        paidUntil: row.proEndsAt,
        cancelledAt: row.cancelledAt,
        recentPayments: payments.map((payment): AdminTenantPayment => ({
          id: payment.id,
          createdAt: payment.createdAt.toISOString(),
          confirmedAt: payment.confirmedAt?.toISOString() ?? null,
          purpose: payment.purpose,
          amountKes: payment.amount,
          status: payment.status,
          phone: maskPhone(payment.phone),
          receipt: payment.receipt,
        })),
      },
      recentAudit: await this.audit.recentForAccount(id),
      generatedAt: now.toISOString(),
    };
  }
}
