import "server-only";
import type {
  AdminAuditPage,
  AdminBilling,
  AdminFunnel,
  AdminFunnelDays,
  AdminOverview,
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

export const getAdminOverview = cache((): Promise<AdminOverview> =>
  apiGet<AdminOverview>("/admin/overview"),
);

export const getAdminFunnel = cache((days: AdminFunnelDays): Promise<AdminFunnel> =>
  apiGet<AdminFunnel>(`/admin/funnel${query({ days: String(days) })}`),
);

export const getAdminRetention = cache((weeks: AdminRetentionWeeks): Promise<AdminRetention> =>
  apiGet<AdminRetention>(`/admin/retention${query({ weeks: String(weeks) })}`),
);

export const getAdminBilling = cache((): Promise<AdminBilling> =>
  apiGet<AdminBilling>("/admin/billing"),
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
