import type { AdminPlan, AdminTenantRow } from "@billsafi/contracts";
import { formatDay, formatRelative } from "../admin-format";

export function planText(plan: AdminPlan): string {
  return plan.code === "pro" && plan.proUntil ? `Pro until ${formatDay(plan.proUntil)}` : "Free";
}

export function lastActivityText(iso: string | null): string {
  return iso ? formatRelative(iso) : "No activity yet";
}

/** The first business, or a note that there is none yet. */
export function businessText(tenant: AdminTenantRow): string {
  const { firstName, count } = tenant.businesses;
  if (!firstName) return "No business yet";
  return count > 1 ? `${firstName} and ${count - 1} more` : firstName;
}
