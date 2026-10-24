import {
  type AdminFunnelDays,
  type AdminRetentionWeeks,
  adminFunnelQuerySchema,
  adminRetentionQuerySchema,
  adminUsersQuerySchema,
} from "@billsafi/contracts";

export const adminTabs = ["overview", "funnel", "retention", "users", "billing"] as const;
export type AdminTab = (typeof adminTabs)[number];

export const adminTabLabels: Record<AdminTab, string> = {
  overview: "Overview",
  funnel: "Funnel",
  retention: "Retention",
  users: "Users",
  billing: "Billing",
};

/** Everything the dashboard keeps in the URL, with unknown values replaced by defaults. */
export interface AdminState {
  tab: AdminTab;
  days: AdminFunnelDays;
  weeks: AdminRetentionWeeks;
  search?: string;
  page: number;
  user?: string;
}

type RawParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminState(raw: RawParams): AdminState {
  const tabParam = first(raw.tab);
  const tab = adminTabs.find((value) => value === tabParam) ?? "overview";
  const funnel = adminFunnelQuerySchema.safeParse({ days: first(raw.days) });
  const retention = adminRetentionQuerySchema.safeParse({ weeks: first(raw.weeks) });
  const users = adminUsersQuerySchema.safeParse({
    page: first(raw.page),
    search: first(raw.search),
  });
  const user = first(raw.user);
  return {
    tab,
    days: funnel.success ? funnel.data.days : 30,
    weeks: retention.success ? retention.data.weeks : 8,
    search: users.success ? users.data.search : undefined,
    page: users.success ? users.data.page : 1,
    user: user && UUID.test(user) ? user : undefined,
  };
}

/**
 * Link to a dashboard view. Only the options that belong to the target tab are
 * kept, and defaults are left out so URLs stay short.
 */
export function adminHref(state: AdminState, changes: Partial<AdminState> = {}): string {
  const next = { ...state, ...changes };
  const params = new URLSearchParams();
  if (next.tab !== "overview") params.set("tab", next.tab);
  if (next.tab === "funnel" && next.days !== 30) params.set("days", String(next.days));
  if (next.tab === "retention" && next.weeks !== 8) params.set("weeks", String(next.weeks));
  if (next.tab === "users") {
    if (next.search) params.set("search", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    if (next.user) params.set("user", next.user);
  }
  const queryString = params.toString();
  return queryString ? `/admin?${queryString}` : "/admin";
}
