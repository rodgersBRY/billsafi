import {
  adminGrantsQuerySchema,
  adminOverridesQuerySchema,
  adminPlanPaymentsQuerySchema,
  adminSubscriptionsQuerySchema,
  adminAuditLogsQuerySchema,
  adminFunnelQuerySchema,
  adminRetentionQuerySchema,
  adminTenantsQuerySchema,
  adminUsersQuerySchema,
} from "@billsafi/contracts";
import type { z } from "zod";

/*
 * URL state for the admin pages. Every page keeps its filters, sort and page in the
 * query string. Each field is parsed on its own with the API's own schema, so one bad
 * value falls back to its default instead of breaking the whole page.
 */

export type RawParams = Record<string, string | string[] | undefined>;
type Shape = Record<string, z.ZodType>;
type Parsed<S extends Shape> = { [K in keyof S]: z.output<S[K]> };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFields<S extends Shape>(shape: S, raw: RawParams): Parsed<S> {
  const parsed: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const field = shape[key]!;
    const result = field.safeParse(first(raw[key]));
    parsed[key] = result.success ? result.data : field.safeParse(undefined).data;
  }
  return parsed as Parsed<S>;
}

export const tenantsDefaults = { page: 1, sort: "registered", dir: "desc" } as const;
export const usersDefaults = { page: 1, sort: "registered", dir: "desc" } as const;
export const auditDefaults = { page: 1 } as const;

export function parseTenantsParams(raw: RawParams) {
  const state = parseFields(adminTenantsQuerySchema.shape, raw);
  // The API refuses both at once; the activity filter offers one or the other.
  if (state.activeWithin && state.inactiveFor) state.inactiveFor = undefined;
  return state;
}
export type TenantsState = ReturnType<typeof parseTenantsParams>;

export function parseUsersParams(raw: RawParams) {
  return parseFields(adminUsersQuerySchema.shape, raw);
}
export type UsersState = ReturnType<typeof parseUsersParams>;

export function parseAuditParams(raw: RawParams) {
  const state = parseFields(adminAuditLogsQuerySchema.shape, raw);
  if (state.from && state.to && state.from > state.to) state.to = undefined;
  return state;
}
export type AuditState = ReturnType<typeof parseAuditParams>;

export const subscriptionsDefaults = { page: 1, sort: "registered", dir: "desc" } as const;

export function parseSubscriptionsParams(raw: RawParams) {
  const state = parseFields(adminSubscriptionsQuerySchema.shape, raw);
  // The filter offers one window at a time.
  if (state.renewalWithin && state.lapsedWithin) state.lapsedWithin = undefined;
  return {
    ...state,
    hasOverride: state.hasOverride === undefined ? undefined : String(state.hasOverride),
  };
}

function withRange<T extends { from?: string; to?: string }>(state: T): T {
  if (state.from && state.to && state.from > state.to) state.to = undefined;
  return state;
}

export function parsePlanPaymentsParams(raw: RawParams) {
  return withRange(parseFields(adminPlanPaymentsQuerySchema.shape, raw));
}

export function parseGrantsParams(raw: RawParams) {
  return withRange(parseFields(adminGrantsQuerySchema.shape, raw));
}

export function parseOverridesParams(raw: RawParams) {
  return parseFields(adminOverridesQuerySchema.shape, raw);
}

const SUBSCRIPTION_TABS = ["subscriptions", "payments", "grants", "overrides", "plans"] as const;
export type SubscriptionTab = (typeof SUBSCRIPTION_TABS)[number];
export const subscriptionTabs = SUBSCRIPTION_TABS;

export function parseSubscriptionTab(raw: RawParams): SubscriptionTab {
  const value = first(raw.tab);
  return SUBSCRIPTION_TABS.find((tab) => tab === value) ?? "subscriptions";
}

/** A Subscriptions tab, with its own filters. */
export const subscriptionsHref = (tab: SubscriptionTab, filters: Values = {}) =>
  `/admin/subscriptions${toQuery({ tab: tab === "subscriptions" ? undefined : tab, ...filters })}`;

export function parseAnalyticsParams(raw: RawParams) {
  const funnel = adminFunnelQuerySchema.safeParse({ days: first(raw.days) });
  const retention = adminRetentionQuerySchema.safeParse({ weeks: first(raw.weeks) });
  return {
    days: funnel.success ? funnel.data.days : 30,
    weeks: retention.success ? retention.data.weeks : 8,
  };
}
export type AnalyticsState = ReturnType<typeof parseAnalyticsParams>;

const TABS = ["overview", "businesses", "subscription", "usage", "activity", "support"] as const;
export type TenantTab = (typeof TABS)[number];
export const tenantTabs = TABS;

export function parseTenantTab(raw: RawParams): TenantTab {
  const value = first(raw.tab);
  return TABS.find((tab) => tab === value) ?? "overview";
}

type Values = Record<string, string | number | undefined>;

/** A query string of the set values, leaving out defaults so URLs stay short. */
export function toQuery(values: Values, defaults: Values = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "" || defaults[key] === value) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** A link to `path` with the current state plus `changes`. */
export function hrefWith(path: string, state: Values, changes: Values, defaults: Values = {}) {
  return `${path}${toQuery({ ...state, ...changes }, defaults)}`;
}

export const tenantHref = (id: string, tab?: TenantTab) =>
  `/admin/tenants/${encodeURIComponent(id)}${tab && tab !== "overview" ? `?tab=${tab}` : ""}`;

export const userHref = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

export const auditHref = (filters: Values) => `/admin/security${toQuery(filters)}`;
