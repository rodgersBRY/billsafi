import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id } from "./columns.js";

/*
 * Facts recorded for the super admin (D066). None of these tables has a foreign key to
 * users or invoices on purpose: history must survive a deleted account, and recording must
 * never be blocked by the rows it describes. The name and kind lists below are copied in
 * @billsafi/contracts (the API has a test that keeps both lists equal).
 */

export const PRODUCT_EVENT_NAMES = [
  "pdf_downloaded",
  "link_opened",
  "generator_started",
  "generator_download_clicked",
  "generator_signup_clicked",
  "guest_invoice_imported",
] as const;

export const OPERATION_FAILURE_KINDS = ["pdf", "email", "job"] as const;
export const JOB_NAMES = [
  "billing_sweep",
  "renewal_reminders",
  "idempotency_prune",
  "maintenance",
] as const;
export const FAILED_SIGN_IN_METHODS = ["password", "google"] as const;
export const FAILED_SIGN_IN_REASONS = [
  "wrong_password",
  "unknown_email",
  "banned",
  "registration_closed",
  "other",
] as const;

const list = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

export const productEvents = pgTable(
  "product_events",
  {
    id: id(),
    name: text("name").notNull(),
    accountId: uuid("account_id"),
    anonymousId: uuid("anonymous_id"),
    invoiceId: uuid("invoice_id"),
    /** Small, validated per name, at most 1 KB. Never invoice contents or personal data. */
    props: jsonb("props").notNull().default(sql`'{}'::jsonb`),
    /** Lets a repeat of the same fact be dropped by the database, such as one link open a day. */
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("product_events_name", sql`${table.name} in (${list(PRODUCT_EVENT_NAMES)})`),
    check("product_events_props_size", sql`pg_column_size(${table.props}) <= 1100`),
    index("product_events_name_created_idx").on(table.name, table.createdAt),
    index("product_events_account_created_idx").on(table.accountId, table.createdAt),
    uniqueIndex("product_events_dedupe_key_idx")
      .on(table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
  ],
);

export const operationFailures = pgTable(
  "operation_failures",
  {
    id: id(),
    kind: text("kind").notNull(),
    /** For example invoice_pdf, public_pdf, password_reset_email or billing_sweep. */
    operation: text("operation").notNull(),
    accountId: uuid("account_id"),
    errorClass: text("error_class").notNull(),
    /** Cleaned of addresses, links and tokens, 300 characters at most. */
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("operation_failures_kind", sql`${table.kind} in (${list(OPERATION_FAILURE_KINDS)})`),
    check("operation_failures_message_length", sql`char_length(${table.message}) <= 300`),
    index("operation_failures_created_idx").on(table.createdAt),
    index("operation_failures_kind_created_idx").on(table.kind, table.createdAt),
    index("operation_failures_account_created_idx").on(table.accountId, table.createdAt),
  ],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    job: text("job").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    /** Counts such as "sent 3 reminders". */
    detail: text("detail"),
    errorClass: text("error_class"),
  },
  (table) => [
    check("job_runs_status", sql`${table.status} in ('succeeded', 'failed')`),
    index("job_runs_job_finished_idx").on(table.job, table.finishedAt),
  ],
);

export const backupRuns = pgTable(
  "backup_runs",
  {
    id: id(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    fileName: text("file_name"),
    error: text("error"),
  },
  (table) => [
    check("backup_runs_status", sql`${table.status} in ('succeeded', 'failed')`),
    index("backup_runs_finished_idx").on(table.finishedAt),
  ],
);

export const failedSignIns = pgTable(
  "failed_sign_ins",
  {
    id: id(),
    /** Lowercased, as typed. Null when the sign-in failed before an address was known. */
    email: text("email"),
    method: text("method").notNull(),
    reason: text("reason").notNull(),
    /** Network part only, as on the sessions list. */
    ipMasked: text("ip_masked"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("failed_sign_ins_method", sql`${table.method} in (${list(FAILED_SIGN_IN_METHODS)})`),
    check("failed_sign_ins_reason", sql`${table.reason} in (${list(FAILED_SIGN_IN_REASONS)})`),
    check("failed_sign_ins_email_length", sql`char_length(${table.email}) <= 320`),
    index("failed_sign_ins_created_idx").on(table.createdAt),
    index("failed_sign_ins_email_created_idx").on(table.email, table.createdAt),
  ],
);
