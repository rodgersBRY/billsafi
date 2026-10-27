import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ADMIN_ACTIVITY_PAGE_SIZE,
  type AdminTenantActivityItem,
  type AdminTenantActivityPage,
  type AdminTenantActivityQuery,
} from "@billsafi/contracts";
import { type DatabaseConnection, sql } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { iso, selectRows } from "../shared/admin-sql.js";

interface Row {
  id: string;
  occurredAt: string;
  type: "event" | "failure";
  name: string;
  operation: string | null;
  props: Record<string, unknown> | null;
  message: string | null;
  invoiceId: string | null;
}

const OPERATIONS: Record<string, string> = {
  invoice_pdf: "Invoice PDF failed to render",
  public_pdf: "Shared link PDF failed to render",
  password_reset_email: "Password reset email failed to send",
  renewal_reminder: "Renewal reminder email failed to send",
};

function summary(row: Row): string {
  if (row.type === "failure") {
    return OPERATIONS[row.operation ?? ""] ?? `${row.operation ?? "An operation"} failed`;
  }
  switch (row.name) {
    case "pdf_downloaded":
      return row.props?.source === "public_link"
        ? "An invoice PDF was downloaded from a shared link"
        : "Downloaded an invoice PDF";
    case "link_opened":
      return "A shared invoice link was opened";
    case "guest_invoice_imported":
      return "Saved a free generator draft into the account";
    default:
      return row.name;
  }
}

/** One account's product events and recorded failures, newest first (D066). */
@Injectable()
export class AdminTenantActivityService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async activity(
    accountId: string,
    query: AdminTenantActivityQuery,
    now = new Date(),
  ): Promise<AdminTenantActivityPage> {
    const db = this.connection.db;
    const [found] = await selectRows<{ id: string }>(
      db,
      sql`select id from users where id = ${accountId}`,
    );
    if (!found) throw new NotFoundException("Tenant not found");

    const rows = await selectRows<Row>(
      db,
      sql`
        select id, ${iso(sql`created_at`)} as "occurredAt", type, name, operation, props, message,
          invoice_id as "invoiceId"
        from (
          select id, created_at, 'event' as type, name, null::text as operation, props,
            null::text as message, invoice_id
          from product_events where account_id = ${accountId}
          union all
          select id, created_at, 'failure', kind, operation, null::jsonb, message, null::uuid
          from operation_failures where account_id = ${accountId}
        ) merged
        order by created_at desc, id desc
        limit ${ADMIN_ACTIVITY_PAGE_SIZE} offset ${(query.page - 1) * ADMIN_ACTIVITY_PAGE_SIZE}
      `,
    );
    const [total] = await selectRows<{ total: number }>(
      db,
      sql`
        select ((select count(*) from product_events where account_id = ${accountId})
          + (select count(*) from operation_failures where account_id = ${accountId}))::int as total
      `,
    );
    const items: AdminTenantActivityItem[] = rows.map((row) => ({
      id: `${row.type}:${row.id}`,
      occurredAt: row.occurredAt,
      type: row.type,
      name: row.name,
      summary: summary(row),
      detail: row.type === "failure" ? row.message : null,
      invoiceId: row.invoiceId,
    }));
    return {
      accountId,
      page: query.page,
      pageSize: ADMIN_ACTIVITY_PAGE_SIZE,
      total: total!.total,
      items,
      generatedAt: now.toISOString(),
    };
  }
}
