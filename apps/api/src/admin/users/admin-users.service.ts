import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUserDetail,
  type AdminUserRow,
  type AdminUserSession,
  type AdminUsersPage,
  type AdminUsersQuery,
  type AdminUserSort,
} from "@billsafi/contracts";
import { type DatabaseConnection, type SQL, sql } from "@billsafi/db";
import { accountStatus } from "@billsafi/domain";
import { containsPattern } from "../../common/like-pattern.js";
import { DATABASE } from "../../database/database.module.js";
import { AdminAuditService } from "../audit/admin-audit.service.js";
import {
  fromUtc,
  isUuid,
  iso,
  selectRows,
  signInMethods,
  toAdminRole,
} from "../shared/admin-sql.js";
import { maskIpAddress, summariseUserAgent } from "./session-display.js";

const RECENT_SESSIONS = 10;

/** Better Auth provider ids behind each sign-in method filter. */
const PROVIDER_FOR_METHOD = { email: "credential", google: "google" } as const;

interface UserRowData {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  banned: boolean;
  providers: string[] | null;
  registeredAt: string;
  lastLoginAt: string | null;
}

const SORT_COLUMNS: Record<AdminUserSort, SQL> = {
  registered: sql`x.registered_at`,
  lastLogin: sql`x.last_login_at`,
};

/** Read-only user directory and user detail: identity, access and sessions. */
@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly audit: AdminAuditService,
  ) {}

  private rows<T>(query: SQL): Promise<T[]> {
    return selectRows<T>(this.connection.db, query);
  }

  /**
   * Users as `x`, with UTC instants for sorting. Last login is the latest session sign-in
   * or refresh; Better Auth refreshes sessions about daily and deletes them on sign-out.
   */
  private readonly usersFrom = sql`(
    select u.*,
      ${fromUtc(sql`u.created_at`)} as registered_at,
      (select ${fromUtc(sql`max(greatest(se.created_at, se.updated_at))`)} from sessions se
        where se.user_id = u.id) as last_login_at
    from users u
  ) x`;

  private readonly columns = sql`
    x.id, x.name, x.email, x.email_verified as "emailVerified", x.role, x.banned,
    (select array_agg(distinct a.provider_id) from accounts a where a.user_id = x.id) as providers,
    ${iso(sql`x.registered_at`)} as "registeredAt", ${iso(sql`x.last_login_at`)} as "lastLoginAt"
  `;

  private where(query: AdminUsersQuery): SQL {
    const conditions: SQL[] = [];
    if (query.search) {
      const pattern = containsPattern(query.search);
      const matches = [sql`x.name ilike ${pattern}`, sql`x.email ilike ${pattern}`];
      if (isUuid(query.search)) matches.push(sql`x.id = ${query.search}::uuid`);
      conditions.push(sql`(${sql.join(matches, sql` or `)})`);
    }
    if (query.role === "admin") conditions.push(sql`x.role = 'admin'`);
    if (query.role === "user") conditions.push(sql`x.role <> 'admin'`);
    if (query.accountStatus)
      conditions.push(sql`x.banned = ${query.accountStatus === "suspended"}`);
    if (query.signInMethod) {
      conditions.push(sql`exists (select 1 from accounts a
        where a.user_id = x.id and a.provider_id = ${PROVIDER_FOR_METHOD[query.signInMethod]})`);
    }
    return conditions.length ? sql.join(conditions, sql` and `) : sql`true`;
  }

  private toRow(row: UserRowData): AdminUserRow {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      role: toAdminRole(row.role),
      accountStatus: accountStatus(row.banned),
      signInMethods: signInMethods(row.providers),
      registeredAt: row.registeredAt,
      lastLoginAt: row.lastLoginAt,
      tenantId: row.id,
    };
  }

  /** 25 users per page, filtered and sorted in SQL. */
  async list(query: AdminUsersQuery, now = new Date()): Promise<AdminUsersPage> {
    const where = this.where(query);
    const [count] = await this.rows<{ total: number }>(
      sql`select count(*)::int as total from ${this.usersFrom} where ${where}`,
    );
    const direction = query.dir === "asc" ? sql`asc` : sql`desc`;
    const rows = await this.rows<UserRowData>(sql`
      select ${this.columns} from ${this.usersFrom}
      where ${where}
      order by ${SORT_COLUMNS[query.sort]} ${direction} nulls last, x.id ${direction}
      limit ${ADMIN_USERS_PAGE_SIZE} offset ${(query.page - 1) * ADMIN_USERS_PAGE_SIZE}
    `);
    return {
      page: query.page,
      pageSize: ADMIN_USERS_PAGE_SIZE,
      total: count!.total,
      users: rows.map((row) => this.toRow(row)),
      generatedAt: now.toISOString(),
    };
  }

  /** One directory row, fresh; 404 when the id is unknown. */
  async summary(id: string): Promise<AdminUserRow> {
    const [row] = await this.rows<UserRowData>(
      sql`select ${this.columns} from ${this.usersFrom} where x.id = ${id}`,
    );
    if (!row) throw new NotFoundException("User not found");
    return this.toRow(row);
  }

  async detail(id: string, now = new Date()): Promise<AdminUserDetail> {
    const user = await this.summary(id);
    const sessions = await this.rows<{
      createdAt: string;
      updatedAt: string;
      expiresAt: string;
      userAgent: string | null;
      ipAddress: string | null;
    }>(sql`
      select
        ${iso(fromUtc(sql`created_at`))} as "createdAt",
        ${iso(fromUtc(sql`updated_at`))} as "updatedAt",
        ${iso(fromUtc(sql`expires_at`))} as "expiresAt",
        user_agent as "userAgent", ip_address as "ipAddress"
      from sessions
      where user_id = ${id}
      order by greatest(created_at, updated_at) desc, id desc
      limit ${RECENT_SESSIONS}
    `);
    return {
      user,
      sessions: sessions.map((session): AdminUserSession => ({
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        device: summariseUserAgent(session.userAgent),
        ipAddress: maskIpAddress(session.ipAddress),
      })),
      recentAudit: await this.audit.recentForAccount(id),
      generatedAt: now.toISOString(),
    };
  }
}
