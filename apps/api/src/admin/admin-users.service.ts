import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUserBusiness,
  type AdminUserDetail,
  type AdminUserRow,
  type AdminUsersPage,
  type AdminUsersQuery,
  invoiceStatuses,
  type InvoiceStatus,
} from "@billsafi/contracts";
import { type DatabaseConnection, desc, eq, schema, type SQL, sql } from "@billsafi/db";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";
import { fromUtc, hasGoogle, iso, planAt, selectRows, signInMethod } from "./admin-sql.js";

const { subscriptionPayments } = schema;

interface UserRowData {
  id: string;
  name: string;
  email: string;
  google: boolean;
  signedUpAt: string;
  anchorAt: string | null;
  paidMonths: number | null;
  businesses: number;
  invoicesReady: number;
  lastActiveAt: string | null;
}

/** Read-only user list and user detail for the admin Users tab. */
@Injectable()
export class AdminUsersService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.connection.db, query);
  }

  /** One row per user with plan, counts and last session; `where` filters `users u`. */
  private userRows(where: SQL, page?: { limit: number; offset: number }) {
    return this.rows<UserRowData>(sql`
      select
        u.id, u.name, u.email,
        ${hasGoogle(sql`u.id`)} as google,
        ${iso(fromUtc(sql`u.created_at`))} as "signedUpAt",
        ${iso(sql`s.anchor_at`)} as "anchorAt",
        s.paid_months as "paidMonths",
        (select count(*) from businesses b where b.owner_user_id = u.id)::int as businesses,
        (select count(*) from invoice_issuances ii where ii.user_id = u.id)::int as "invoicesReady",
        -- Better Auth refreshes sessions about daily and deletes them on sign-out.
        (select ${iso(fromUtc(sql`max(se.updated_at)`))} from sessions se
          where se.user_id = u.id) as "lastActiveAt"
      from users u
      left join subscriptions s on s.user_id = u.id
      where ${where}
      order by u.created_at desc, u.id desc
      ${page ? sql`limit ${page.limit} offset ${page.offset}` : sql``}
    `);
  }

  private toRow(row: UserRowData, now: Date): AdminUserRow {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      signInMethod: signInMethod(row.google),
      plan: planAt(row.anchorAt ? new Date(row.anchorAt) : null, row.paidMonths ?? 0, now),
      signedUpAt: row.signedUpAt,
      businesses: row.businesses,
      invoicesReady: row.invoicesReady,
      lastActiveAt: row.lastActiveAt,
    };
  }

  /** 25 users per page, newest first, optionally matching name or email. */
  async list(query: AdminUsersQuery, now = new Date()): Promise<AdminUsersPage> {
    const pattern = query.search ? containsPattern(query.search) : null;
    const where = pattern ? sql`(u.name ilike ${pattern} or u.email ilike ${pattern})` : sql`true`;

    const [count] = await this.rows<{ total: number }>(
      sql`select count(*)::int as total from users u where ${where}`,
    );
    const rows = await this.userRows(where, {
      limit: ADMIN_USERS_PAGE_SIZE,
      offset: (query.page - 1) * ADMIN_USERS_PAGE_SIZE,
    });
    return {
      page: query.page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
      total: count!.total,
      users: rows.map((row) => this.toRow(row, now)),
      generatedAt: now.toISOString(),
    };
  }

  /** One user with their businesses and plan payments; 404 when the id is unknown. */
  async detail(userId: string, now = new Date()): Promise<AdminUserDetail> {
    const [row] = await this.userRows(sql`u.id = ${userId}`);
    if (!row) throw new NotFoundException("User not found");

    const businesses = await this.rows<{
      id: string;
      name: string;
      createdAt: string;
      clients: number;
      invoices: Partial<Record<InvoiceStatus, number>> | null;
    }>(sql`
      select
        b.id, b.display_name as name, ${iso(sql`b.created_at`)} as "createdAt",
        (select count(*) from clients c where c.business_id = b.id)::int as clients,
        (select json_object_agg(status, n) from (
          select i.status, count(*)::int as n from invoices i
          where i.business_id = b.id group by i.status
        ) by_status) as invoices
      from businesses b
      where b.owner_user_id = ${userId}
      order by b.created_at
    `);

    const payments = await this.connection.db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.userId, userId))
      .orderBy(desc(subscriptionPayments.createdAt));

    return {
      user: this.toRow(row, now),
      businesses: businesses.map((business): AdminUserBusiness => ({
        ...business,
        // Every status is present, zero when the business has none.
        invoices: Object.fromEntries(
          invoiceStatuses.map((status) => [status, business.invoices?.[status] ?? 0]),
        ) as Record<InvoiceStatus, number>,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        createdAt: payment.createdAt.toISOString(),
        confirmedAt: payment.confirmedAt?.toISOString() ?? null,
        purpose: payment.purpose,
        amountKes: payment.amount,
        status: payment.status,
        receipt: payment.receipt,
      })),
    };
  }
}
