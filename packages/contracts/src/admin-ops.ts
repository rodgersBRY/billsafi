import { z } from "zod";
import type { AdminActionAck, AdminAuditRow, AdminPlan, AdminSubscriptionStatus } from "./admin.js";
import { reasonSchema } from "./admin.js";
import type { AdminPlanPayment } from "./admin-subscriptions.js";
import {
  blankToUndefined,
  optionalEnum,
  pageParam,
  searchParam,
  sortDirParam,
} from "./query-params.js";

/*
 * Super admin phase 6: system health, support cases and platform settings (D065).
 * Dates are ISO instants unless noted.
 */

/* ---------------------------------------------------------------- Health */

/** unknown is a real state: the data is not recorded yet, or is too old to trust. */
export const adminHealthStatuses = ["ok", "warning", "failing", "unknown"] as const;
export type AdminHealthStatus = (typeof adminHealthStatuses)[number];

const instant = z.iso.datetime({ offset: true });

export const adminHealthIndicatorSchema = z.object({
  /** Stable id such as "database" or "mpesa"; phase 5 adds more. */
  key: z.string(),
  label: z.string(),
  status: z.enum(adminHealthStatuses),
  /** The headline figure as text, such as "12 ms"; null when there is none. */
  value: z.string().nullable(),
  /** One plain sentence on what was checked or why the status is unknown. */
  detail: z.string(),
  /** Numbers behind the value, for the page to draw; omitted when there are none. */
  data: z.record(z.string(), z.number().nullable()).optional(),
  /** When the fact was read: now for a live check, the last recording time otherwise. */
  checkedAt: instant,
  /** Where the fact comes from, such as "Live query". */
  source: z.string(),
  /** Seconds after which `checkedAt` is too old to trust; null when the check is live. */
  staleAfterSeconds: z.number().nullable(),
  href: z.string().optional(),
});
export type AdminHealthIndicator = z.infer<typeof adminHealthIndicatorSchema>;

/** A link-out card to a tool that holds the real availability and error figures. */
export const adminHealthLinkSchema = z.object({
  key: z.enum(["sentry", "uptime"]),
  label: z.string(),
  href: z.url({ protocol: /^https$/ }),
  description: z.string(),
});
export type AdminHealthLink = z.infer<typeof adminHealthLinkSchema>;

export const adminHealthSchema = z.object({
  indicators: z.array(adminHealthIndicatorSchema),
  links: z.array(adminHealthLinkSchema),
  generatedAt: instant,
});
export type AdminHealth = z.infer<typeof adminHealthSchema>;

/* --------------------------------------------------------------- Support */

export const supportCategories = [
  "billing",
  "sign_in",
  "invoices",
  "payments",
  "bug",
  "other",
] as const;
export type SupportCategory = (typeof supportCategories)[number];

export const supportSeverities = ["low", "normal", "high", "urgent"] as const;
export type SupportSeverity = (typeof supportSeverities)[number];

export const supportStatuses = ["open", "waiting", "resolved"] as const;
export type SupportStatus = (typeof supportStatuses)[number];

/**
 * open, waiting and resolved match the status; recent is any status updated in the last 7
 * days. Leave the tab out for every case.
 */
export const supportTabs = ["open", "waiting", "recent", "resolved"] as const;
export type SupportTab = (typeof supportTabs)[number];

export const supportSorts = ["updated", "created", "severity"] as const;
export type SupportSort = (typeof supportSorts)[number];

export const ADMIN_SUPPORT_PAGE_SIZE = 25;
export const SUPPORT_RECENT_DAYS = 7;
export const SUPPORT_TITLE_MAX = 120;
export const SUPPORT_NOTE_MAX = 5000;
export const SUPPORT_RESOLUTION_MAX = 2000;

const titleSchema = z
  .string({ error: "Enter a title" })
  .trim()
  .min(3, "Enter a title of at least 3 characters")
  .max(SUPPORT_TITLE_MAX, `Keep the title under ${SUPPORT_TITLE_MAX + 1} characters`);

export const adminSupportCasesQuerySchema = z.object({
  page: pageParam,
  tab: optionalEnum(supportTabs),
  status: optionalEnum(supportStatuses),
  severity: optionalEnum(supportSeverities),
  category: optionalEnum(supportCategories),
  /** Title, account name or email, or an exact account or case id. */
  search: searchParam,
  accountId: z.preprocess(blankToUndefined, z.uuid().optional()),
  sort: z.preprocess(blankToUndefined, z.enum(supportSorts).default("updated")),
  dir: sortDirParam,
});
export type AdminSupportCasesQuery = z.output<typeof adminSupportCasesQuerySchema>;

export const adminSupportCaseCreateSchema = z.object({
  accountId: z.uuid({ error: "Choose an account" }),
  title: titleSchema,
  category: z.enum(supportCategories, { error: "Choose a category" }),
  severity: z.enum(supportSeverities).default("normal"),
  /** An admin's user id; null or left out means nobody. */
  assignedTo: z.uuid().nullish(),
  reason: reasonSchema,
});
export type AdminSupportCaseCreate = z.output<typeof adminSupportCaseCreateSchema>;

/** Resolving and reopening have their own routes, so status here is open or waiting. */
export const adminSupportCaseUpdateSchema = z
  .object({
    title: titleSchema.optional(),
    category: z.enum(supportCategories).optional(),
    severity: z.enum(supportSeverities).optional(),
    status: z.enum(["open", "waiting"]).optional(),
    assignedTo: z.uuid().nullable().optional(),
    reason: reasonSchema,
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.category !== undefined ||
      value.severity !== undefined ||
      value.status !== undefined ||
      value.assignedTo !== undefined,
    { message: "Change at least one field", path: ["title"] },
  );
export type AdminSupportCaseUpdate = z.output<typeof adminSupportCaseUpdateSchema>;

export const adminSupportResolveSchema = z.object({
  resolution: z
    .string({ error: "Say how it was resolved" })
    .trim()
    .min(3, "Say how it was resolved")
    .max(
      SUPPORT_RESOLUTION_MAX,
      `Keep the resolution under ${SUPPORT_RESOLUTION_MAX + 1} characters`,
    ),
  reason: reasonSchema,
});
export type AdminSupportResolve = z.output<typeof adminSupportResolveSchema>;

/**
 * Notes are append-only. The reason is optional here: a note is its own explanation, so the
 * audit row says "Internal note" when none is sent. The note text itself is never audited.
 */
export const adminSupportNoteCreateSchema = z.object({
  body: z
    .string({ error: "Write a note" })
    .trim()
    .min(1, "Write a note")
    .max(SUPPORT_NOTE_MAX, `Keep the note under ${SUPPORT_NOTE_MAX + 1} characters`),
  reason: reasonSchema.optional(),
});
export type AdminSupportNoteCreate = z.output<typeof adminSupportNoteCreateSchema>;

export const adminSupportPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export type AdminSupportPerson = z.infer<typeof adminSupportPersonSchema>;

export const adminSupportCaseRowSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  account: z.object({ name: z.string(), email: z.string() }),
  title: z.string(),
  category: z.enum(supportCategories),
  severity: z.enum(supportSeverities),
  status: z.enum(supportStatuses),
  assignedTo: adminSupportPersonSchema.nullable(),
  createdBy: adminSupportPersonSchema.nullable(),
  createdAt: instant,
  updatedAt: instant,
  resolvedAt: instant.nullable(),
  /** Set while the case is resolved; cleared on reopen. */
  resolution: z.string().nullable(),
  noteCount: z.number().int(),
});
export type AdminSupportCaseRow = z.infer<typeof adminSupportCaseRowSchema>;

export const adminSupportCasesPageSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  cases: z.array(adminSupportCaseRowSchema),
  generatedAt: instant,
});
export type AdminSupportCasesPage = z.infer<typeof adminSupportCasesPageSchema>;

export const adminSupportNoteSchema = z.object({
  id: z.string(),
  /** Null for a loose note on the account. */
  caseId: z.string().nullable(),
  accountId: z.string(),
  author: adminSupportPersonSchema.nullable(),
  body: z.string(),
  createdAt: instant,
});
export type AdminSupportNote = z.infer<typeof adminSupportNoteSchema>;

/** A change to the case, from its audit rows. Note text never appears here. */
export const adminSupportTimelineEntrySchema = z.object({
  id: z.string(),
  occurredAt: instant,
  /** support.case_create, support.case_update, support.case_resolve or support.case_reopen. */
  action: z.string(),
  actor: z.object({
    userId: z.string().nullable(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
  reason: z.string().nullable(),
  /** Before and after values, such as { status: { from: "open", to: "waiting" } }. */
  changes: z.unknown(),
});
export type AdminSupportTimelineEntry = z.infer<typeof adminSupportTimelineEntrySchema>;

/** Read-only facts about the case's account, from data the tenant page already has. */
export interface AdminSupportDiagnostics {
  subscription: {
    status: AdminSubscriptionStatus;
    plan: AdminPlan;
  };
  lastPayment: AdminPlanPayment | null;
  /** Pending plan payments older than the stuck cutoff. */
  stuckPayments: number;
  /** The last 5 admin actions on the account, newest first. */
  recentActions: AdminAuditRow[];
}

export const adminSupportCaseDetailSchema = z.object({
  case: adminSupportCaseRowSchema,
  /** Oldest first. */
  notes: z.array(adminSupportNoteSchema),
  /** Oldest first. */
  timeline: z.array(adminSupportTimelineEntrySchema),
  diagnostics: z.custom<AdminSupportDiagnostics>(),
  generatedAt: instant,
});
export type AdminSupportCaseDetail = z.infer<typeof adminSupportCaseDetailSchema>;

/** For the tenant page's Support tab. */
export const adminSupportAccountSchema = z.object({
  accountId: z.string(),
  cases: z.array(adminSupportCaseRowSchema),
  /** Notes with no case, newest first. */
  notes: z.array(adminSupportNoteSchema),
  generatedAt: instant,
});
export type AdminSupportAccount = z.infer<typeof adminSupportAccountSchema>;

export type AdminSupportCaseResult = AdminSupportCaseRow | AdminActionAck;
export type AdminSupportNoteResult = AdminSupportNote | AdminActionAck;

/* --------------------------------------------------------------- Settings */

export const platformSettingKeys = ["registration", "announcement", "support_contact"] as const;
export type PlatformSettingKey = (typeof platformSettingKeys)[number];

const blankToNone = (value: unknown) => (value === "" || value === null ? undefined : value);
const instantInput = (message: string) => z.iso.datetime({ offset: true, error: message });

export const registrationSettingSchema = z.object({
  open: z.boolean({ error: "Choose open or closed" }),
  /** Shown on the sign-up page and in the sign-up error while registration is closed. */
  closedMessage: z
    .string({ error: "Enter the message" })
    .trim()
    .min(1, "Enter the message")
    .max(200, "Keep the message under 201 characters"),
});
export type RegistrationSetting = z.output<typeof registrationSettingSchema>;

export const announcementTones = ["info", "warning"] as const;
export type AnnouncementTone = (typeof announcementTones)[number];

export const announcementSettingSchema = z
  .object({
    active: z.boolean({ error: "Choose on or off" }),
    tone: z.enum(announcementTones, { error: "Choose a tone" }),
    message: z
      .string({ error: "Enter the message" })
      .trim()
      .max(200, "Keep the message under 201 characters"),
    linkUrl: z.preprocess(
      blankToNone,
      z
        .url({ protocol: /^https$/, error: "Enter a link that starts with https://" })
        .max(500)
        .optional(),
    ),
    startsAt: z.preprocess(
      blankToNone,
      instantInput("Enter the start as an ISO date and time").optional(),
    ),
    endsAt: z.preprocess(
      blankToNone,
      instantInput("Enter the end as an ISO date and time").optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.active && value.message.length === 0) {
      context.addIssue({ code: "custom", path: ["message"], message: "Enter the message" });
    }
    if (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The end must be after the start",
      });
    }
  });
export type AnnouncementSetting = z.output<typeof announcementSettingSchema>;

export const supportContactSettingSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }).max(200),
  whatsapp: z.preprocess(
    blankToNone,
    z
      .string()
      .regex(/^\+[1-9]\d{7,14}$/, "Enter the number with its country code, like +254712345678")
      .optional(),
  ),
  hours: z.preprocess(blankToNone, z.string().trim().min(1).max(100).optional()),
});
export type SupportContactSetting = z.output<typeof supportContactSettingSchema>;

export interface PlatformSettingValues {
  registration: RegistrationSetting;
  announcement: AnnouncementSetting;
  support_contact: SupportContactSetting;
}

export const platformSettingSchemas = {
  registration: registrationSettingSchema,
  announcement: announcementSettingSchema,
  support_contact: supportContactSettingSchema,
} as const satisfies { [K in PlatformSettingKey]: z.ZodType<PlatformSettingValues[K]> };

export const platformSettingLabels: Record<PlatformSettingKey, string> = {
  registration: "Registration",
  announcement: "Announcement banner",
  support_contact: "Support contact",
};

/** What a missing row means. Kept in code so a fresh database needs no seed. */
export const platformSettingDefaults: PlatformSettingValues = {
  registration: {
    open: true,
    closedMessage: "Sign-ups are paused for now. Please check back soon.",
  },
  announcement: { active: false, tone: "info", message: "" },
  support_contact: { email: "support@billsafi.com" },
};

/** The body of PUT /admin/settings/:key for one key. */
export function adminSettingUpdateSchema<K extends PlatformSettingKey>(key: K) {
  return z.object({ value: platformSettingSchemas[key], reason: reasonSchema });
}

export type AdminSettingUpdate<K extends PlatformSettingKey = PlatformSettingKey> = {
  [P in K]: { value: PlatformSettingValues[P]; reason: string };
}[K];

const settingBase = {
  label: z.string(),
  /** True when no row is stored or the stored value equals the default. */
  isDefault: z.boolean(),
  updatedBy: adminSupportPersonSchema.nullable(),
  updatedAt: instant.nullable(),
};

export const adminSettingSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("registration"),
    value: registrationSettingSchema,
    default: registrationSettingSchema,
    ...settingBase,
  }),
  z.object({
    key: z.literal("announcement"),
    value: announcementSettingSchema,
    default: announcementSettingSchema,
    ...settingBase,
  }),
  z.object({
    key: z.literal("support_contact"),
    value: supportContactSettingSchema,
    default: supportContactSettingSchema,
    ...settingBase,
  }),
]);
export type AdminSetting<K extends PlatformSettingKey = PlatformSettingKey> = Extract<
  z.infer<typeof adminSettingSchema>,
  { key: K }
>;

export const adminSettingsSchema = z.object({
  /** One per key, in the order of platformSettingKeys. */
  settings: z.array(adminSettingSchema),
  generatedAt: instant,
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;

/** GET /api/v1/platform: public, so only what a visitor needs. */
export const platformInfoSchema = z.object({
  registration: z.object({ open: z.boolean(), closedMessage: z.string() }),
  /** The announcement while it is switched on and inside its time window; otherwise null. */
  announcement: z
    .object({
      tone: z.enum(announcementTones),
      message: z.string(),
      linkUrl: z.string().nullable(),
    })
    .nullable(),
  supportContact: supportContactSettingSchema,
});
export type PlatformInfo = z.infer<typeof platformInfoSchema>;

/** Error code on the 403 that a closed registration returns (and in the Google redirect). */
export const REGISTRATION_CLOSED_CODE = "REGISTRATION_CLOSED";
