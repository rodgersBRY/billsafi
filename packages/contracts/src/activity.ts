import { z } from "zod";
import { blankToUndefined, optionalEnum, pageParam, searchParam } from "./query-params.js";

/*
 * Super admin phase 5 (D066): the facts BillSafi records. A short fixed list of event
 * names, each with a tiny typed payload. No free-form events, no IPs, no invoice contents.
 */

/** Where the anonymous id lives in the visitor's browser (localStorage). */
export const ANONYMOUS_ID_STORAGE_KEY = "billsafi.anonymous-id";
export const EVENT_PROPS_MAX_BYTES = 1024;

/** Sent by the browser through POST /api/v1/events, with an anonymous id and no account. */
export const generatorEventNames = [
  "generator_started",
  "generator_download_clicked",
  "generator_signup_clicked",
] as const;
export type GeneratorEventName = (typeof generatorEventNames)[number];

/** Written by the API where the action happens. Never accepted from the browser. */
export const serverEventNames = [
  "pdf_downloaded",
  "link_opened",
  "guest_invoice_imported",
] as const;

export const productEventNames = [...serverEventNames, ...generatorEventNames] as const;
export type ProductEventName = (typeof productEventNames)[number];

export const pdfSources = ["app", "public_link"] as const;
export type PdfSource = (typeof pdfSources)[number];

const none = z.strictObject({});

/** The payload each event may carry. Anything else is refused. */
export const eventPropsSchemas = {
  pdf_downloaded: z.strictObject({ source: z.enum(pdfSources) }),
  link_opened: none,
  guest_invoice_imported: z.strictObject({ usedExistingBusiness: z.boolean() }),
  generator_started: none,
  generator_download_clicked: none,
  generator_signup_clicked: none,
} as const satisfies Record<ProductEventName, z.ZodType>;

export type EventProps<N extends ProductEventName> = z.output<(typeof eventPropsSchemas)[N]>;

export const PRODUCT_EVENT_RETENTION_MONTHS = 13;
export const FAILURE_RETENTION_DAYS = 90;
export const JOB_RUN_RETENTION_DAYS = 30;
export const BACKUP_RUN_RETENTION_MONTHS = 13;

/** The body of POST /api/v1/events. */
export const publicEventSchema = z
  .strictObject({
    name: z.enum(generatorEventNames),
    anonymousId: z.uuid(),
    props: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((event, ctx) => {
    const props = event.props ?? {};
    if (JSON.stringify(props).length > EVENT_PROPS_MAX_BYTES) {
      ctx.addIssue({ code: "custom", path: ["props"], message: "Props are too large" });
      return;
    }
    const result = eventPropsSchemas[event.name].safeParse(props);
    if (!result.success) {
      ctx.addIssue({ code: "custom", path: ["props"], message: "Props are not allowed" });
    }
  });
export type PublicEvent = z.output<typeof publicEventSchema>;

export const operationFailureKinds = ["pdf", "email", "job"] as const;
export type OperationFailureKind = (typeof operationFailureKinds)[number];

export const jobNames = [
  "billing_sweep",
  "renewal_reminders",
  "idempotency_prune",
  "maintenance",
] as const;
export type JobName = (typeof jobNames)[number];

export const failedSignInMethods = ["password", "google"] as const;
export type FailedSignInMethod = (typeof failedSignInMethods)[number];

export const failedSignInReasons = [
  "wrong_password",
  "unknown_email",
  "banned",
  "registration_closed",
  "other",
] as const;
export type FailedSignInReason = (typeof failedSignInReasons)[number];

const instant = z.string();
const count = z.number().int().min(0);

export const ADMIN_ACTIVITY_PAGE_SIZE = 25;

/** Ten failures for one email inside one clock hour count as repeated. */
export const REPEATED_FAILED_SIGN_INS = 10;

/* ---- Recent failures: GET /admin/health/failures ---- */

export const adminFailuresQuerySchema = z.object({
  kind: optionalEnum(operationFailureKinds),
  page: pageParam,
});
export type AdminFailuresQuery = z.output<typeof adminFailuresQuerySchema>;

export const adminFailureRowSchema = z.object({
  id: z.string(),
  occurredAt: instant,
  kind: z.enum(operationFailureKinds),
  operation: z.string(),
  account: z.object({ id: z.string(), name: z.string() }).nullable(),
  errorClass: z.string(),
  message: z.string(),
});
export type AdminFailureRow = z.infer<typeof adminFailureRowSchema>;

export const adminFailuresPageSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: count,
  /** Newest first. */
  items: z.array(adminFailureRowSchema),
  /** Failures in the last 24 hours by kind, whatever the filter. */
  last24h: z.object({ pdf: count, email: count, job: count }),
  generatedAt: instant,
});
export type AdminFailuresPage = z.infer<typeof adminFailuresPageSchema>;

/* ---- Failed sign-ins: GET /admin/security/failed-sign-ins ---- */

export const adminFailedSignInsQuerySchema = z.object({
  page: pageParam,
  /** Part of the email, case ignored. */
  email: searchParam,
  method: optionalEnum(failedSignInMethods),
  reason: optionalEnum(failedSignInReasons),
  range: z.preprocess(blankToUndefined, z.enum(["7d", "30d", "90d", "12m"]).default("7d")),
});
export type AdminFailedSignInsQuery = z.output<typeof adminFailedSignInsQuerySchema>;

export const adminFailedSignInRowSchema = z.object({
  id: z.string(),
  occurredAt: instant,
  email: z.string().nullable(),
  method: z.enum(failedSignInMethods),
  reason: z.enum(failedSignInReasons),
  ipMasked: z.string().nullable(),
});
export type AdminFailedSignInRow = z.infer<typeof adminFailedSignInRowSchema>;

export const adminFailedSignInsPageSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: count,
  items: z.array(adminFailedSignInRowSchema),
  /** Counts and top lists ignore the filters. */
  summary: z.object({
    last24h: count,
    last7d: count,
    /** Emails with the most failures in the last 24 hours, up to 5. */
    topEmails: z.array(z.object({ email: z.string(), count })),
    /** Masked networks with the most failures in the last 24 hours, up to 5. */
    topIps: z.array(z.object({ ipMasked: z.string(), count })),
  }),
  generatedAt: instant,
});
export type AdminFailedSignInsPage = z.infer<typeof adminFailedSignInsPageSchema>;

/* ---- A tenant's activity: GET /admin/tenants/:id/activity ---- */

export const adminTenantActivityQuerySchema = z.object({ page: pageParam });
export type AdminTenantActivityQuery = z.output<typeof adminTenantActivityQuerySchema>;

export const adminTenantActivityItemSchema = z.object({
  id: z.string(),
  occurredAt: instant,
  type: z.enum(["event", "failure"]),
  /** The event name, or the failure kind. */
  name: z.string(),
  /** One plain sentence. */
  summary: z.string(),
  /** The failure message; null for events. */
  detail: z.string().nullable(),
  invoiceId: z.string().nullable(),
});
export type AdminTenantActivityItem = z.infer<typeof adminTenantActivityItemSchema>;

export const adminTenantActivityPageSchema = z.object({
  accountId: z.string(),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: count,
  /** Newest first. */
  items: z.array(adminTenantActivityItemSchema),
  generatedAt: instant,
});
export type AdminTenantActivityPage = z.infer<typeof adminTenantActivityPageSchema>;

/* ---- Overview and Analytics additions ---- */

export const adminFailedOperationsSchema = z.object({
  total: count,
  mpesa: count,
  pdf: count,
  email: count,
  jobs: count,
});
export type AdminFailedOperations = z.infer<typeof adminFailedOperationsSchema>;

export const adminPdfDownloadsSchema = z.object({ app: count, publicLink: count });

export const generatorFunnelKeys = [
  "started",
  "download_clicked",
  "signup_clicked",
  "imported",
] as const;
export type GeneratorFunnelKey = (typeof generatorFunnelKeys)[number];

export const adminGeneratorFunnelSchema = z.object({
  /** Always the four keys, in order. Each counts distinct anonymous visitors in the range. */
  steps: z.array(
    z.object({
      key: z.enum(generatorFunnelKeys),
      count,
      /** Share of the visitors who started; null when nobody did. */
      share: z.number().min(0).max(1).nullable(),
    }),
  ),
});
export type AdminGeneratorFunnel = z.infer<typeof adminGeneratorFunnelSchema>;
