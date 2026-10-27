import "server-only";
import type {
  AdminFailedSignInsPage,
  AdminFailuresPage,
  AdminTenantActivityPage,
  AdminGrantsPage,
  AdminHealth,
  AdminSettings,
  AdminSupportAccount,
  AdminSupportCaseDetail,
  AdminSupportCasesPage,
  AdminOverridesPage,
  AdminPlanPaymentsPage,
  AdminSubscriptionsPage,
  AdminAuditPage,
  AdminBilling,
  AdminFunnel,
  AdminFunnelDays,
  AdminActivity,
  AdminAnalytics,
  AdminOverview,
  AdminRange,
  AdminTrends,
  AdminRetention,
  AdminRetentionWeeks,
  AdminTenantDetail,
  AdminTenantsPage,
  AdminUserDetail,
  AdminUsersPage,
} from "@billsafi/contracts";
import { cache } from "react";
import { getSessionUser } from "./auth";
import { apiGet, query } from "./request";

/*
 * Admin data. The API answers 404 to anyone who isn't an admin, which apiGet turns
 * into the normal not-found page. Each call is memoised per request, so the layout,
 * the page metadata and the page share one fetch. List queries are passed as a query
 * string (built in components/admin/admin-params.ts) so the memo key is a plain string.
 */

/** Resolves for admins only; anyone else ends on the not-found page. */
export const getAdminAccess = cache((): Promise<void> => apiGet<void>("/admin/access"));

/** The signed-in admin, to tell their own account apart from others. */
export const getAdminSelf = cache(getSessionUser);

export const getAdminOverview = cache((range: AdminRange): Promise<AdminOverview> =>
  apiGet<AdminOverview>(`/admin/overview${query({ range })}`),
);

export const getAdminTrends = cache((range: AdminRange): Promise<AdminTrends> =>
  apiGet<AdminTrends>(`/admin/overview/trends${query({ range })}`),
);

export const getAdminActivity = cache((limit: number): Promise<AdminActivity> =>
  apiGet<AdminActivity>(`/admin/activity${query({ limit: String(limit) })}`),
);

export const getAdminAnalytics = cache((range: AdminRange): Promise<AdminAnalytics> =>
  apiGet<AdminAnalytics>(`/admin/analytics${query({ range })}`),
);

export const getAdminFunnel = cache((days: AdminFunnelDays): Promise<AdminFunnel> =>
  apiGet<AdminFunnel>(`/admin/funnel${query({ days: String(days) })}`),
);

export const getAdminRetention = cache((weeks: AdminRetentionWeeks): Promise<AdminRetention> =>
  apiGet<AdminRetention>(`/admin/retention${query({ weeks: String(weeks) })}`),
);

/** `thisMonthOnly` limits the Free limit hits to the current Nairobi month (`limitHits=this_month`). */
export const getAdminBilling = cache((thisMonthOnly: boolean = false): Promise<AdminBilling> =>
  apiGet<AdminBilling>(`/admin/billing${thisMonthOnly ? query({ limitHits: "this_month" }) : ""}`),
);

export const getAdminTenants = cache((queryString: string): Promise<AdminTenantsPage> =>
  apiGet<AdminTenantsPage>(`/admin/tenants${queryString}`),
);

export const getAdminTenant = cache((id: string): Promise<AdminTenantDetail> =>
  apiGet<AdminTenantDetail>(`/admin/tenants/${encodeURIComponent(id)}`),
);

export const getAdminUsers = cache((queryString: string): Promise<AdminUsersPage> =>
  apiGet<AdminUsersPage>(`/admin/users${queryString}`),
);

export const getAdminUser = cache((id: string): Promise<AdminUserDetail> =>
  apiGet<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`),
);

export const getAdminAuditLogs = cache((queryString: string): Promise<AdminAuditPage> =>
  apiGet<AdminAuditPage>(`/admin/audit-logs${queryString}`),
);

export const getAdminSubscriptions = cache((queryString: string): Promise<AdminSubscriptionsPage> =>
  apiGet<AdminSubscriptionsPage>(`/admin/subscriptions${queryString}`),
);

export const getAdminPlanPayments = cache((queryString: string): Promise<AdminPlanPaymentsPage> =>
  apiGet<AdminPlanPaymentsPage>(`/admin/subscription-payments${queryString}`),
);

export const getAdminGrants = cache((queryString: string): Promise<AdminGrantsPage> =>
  apiGet<AdminGrantsPage>(`/admin/grants${queryString}`),
);

export const getAdminOverrides = cache((queryString: string): Promise<AdminOverridesPage> =>
  apiGet<AdminOverridesPage>(`/admin/overrides${queryString}`),
);

/** Never cached by the API: a refresh should read the databases again. */
export const getAdminHealth = cache((): Promise<AdminHealth> =>
  apiGet<AdminHealth>("/admin/health"),
);

export const getAdminSupportCases = cache((queryString: string): Promise<AdminSupportCasesPage> =>
  apiGet<AdminSupportCasesPage>(`/admin/support/cases${queryString}`),
);

export const getAdminSupportCase = cache((id: string): Promise<AdminSupportCaseDetail> =>
  apiGet<AdminSupportCaseDetail>(`/admin/support/cases/${encodeURIComponent(id)}`),
);

export const getAdminSupportAccount = cache((accountId: string): Promise<AdminSupportAccount> =>
  apiGet<AdminSupportAccount>(`/admin/support/accounts/${encodeURIComponent(accountId)}`),
);

export const getAdminSettings = cache((): Promise<AdminSettings> =>
  apiGet<AdminSettings>("/admin/settings"),
);

/** Never cached by the API, like Health. */
export const getAdminFailures = cache((queryString: string): Promise<AdminFailuresPage> =>
  apiGet<AdminFailuresPage>(`/admin/health/failures${queryString}`),
);

export const getAdminFailedSignIns = cache((queryString: string): Promise<AdminFailedSignInsPage> =>
  apiGet<AdminFailedSignInsPage>(`/admin/security/failed-sign-ins${queryString}`),
);

export const getAdminTenantActivity = cache(
  (id: string, queryString: string): Promise<AdminTenantActivityPage> =>
    apiGet<AdminTenantActivityPage>(
      `/admin/tenants/${encodeURIComponent(id)}/activity${queryString}`,
    ),
);
