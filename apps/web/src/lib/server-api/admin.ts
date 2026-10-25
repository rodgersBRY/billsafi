import "server-only";
import type {
  AdminBilling,
  AdminFunnel,
  AdminFunnelDays,
  AdminOverview,
  AdminRetention,
  AdminRetentionWeeks,
  AdminTenantDetail,
  AdminTenantsPage,
} from "@billsafi/contracts";
import { cache } from "react";
import { apiGet, query } from "./request";

/*
 * Read-only admin dashboard data. The API answers 404 to anyone who isn't an
 * admin, which apiGet turns into the normal not-found page. Each call is
 * memoised per request, so the page metadata and the page share one fetch.
 */

export const getAdminOverview = cache((): Promise<AdminOverview> =>
  apiGet<AdminOverview>("/admin/overview"),
);

export const getAdminFunnel = cache((days: AdminFunnelDays): Promise<AdminFunnel> =>
  apiGet<AdminFunnel>(`/admin/funnel${query({ days: String(days) })}`),
);

export const getAdminRetention = cache((weeks: AdminRetentionWeeks): Promise<AdminRetention> =>
  apiGet<AdminRetention>(`/admin/retention${query({ weeks: String(weeks) })}`),
);

// The Users tab lists accounts (tenants) until the admin shell replaces it.
export const getAdminUsers = cache((page: number, search?: string): Promise<AdminTenantsPage> =>
  apiGet<AdminTenantsPage>(`/admin/tenants${query({ page: String(page), search })}`),
);

export const getAdminUser = cache((userId: string): Promise<AdminTenantDetail> =>
  apiGet<AdminTenantDetail>(`/admin/tenants/${encodeURIComponent(userId)}`),
);

export const getAdminBilling = cache((): Promise<AdminBilling> =>
  apiGet<AdminBilling>("/admin/billing"),
);
