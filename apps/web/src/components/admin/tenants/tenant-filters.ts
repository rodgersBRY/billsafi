import {
  adminAccountStatuses,
  adminLifecycleStages,
  adminSubscriptionStatuses,
  adminWindowDays,
} from "@billsafi/contracts";
import { type FilterField, selectField } from "../filter-fields";
import { accountStatusLabels, lifecycleLabels, subscriptionStatusLabels } from "../status-badge";

/** The tenants directory filters (spec section 22.2). */
export const tenantFilters: FilterField[] = [
  {
    type: "search",
    name: "search",
    label: "Search",
    placeholder: "Owner, email, business or account ID",
  },
  selectField(
    "accountStatus",
    "Account status",
    "Any account status",
    adminAccountStatuses.map((value) => [value, accountStatusLabels[value]] as const),
  ),
  selectField(
    "subscriptionStatus",
    "Subscription",
    "Any subscription",
    adminSubscriptionStatuses.map((value) => [value, subscriptionStatusLabels[value]] as const),
  ),
  selectField(
    "lifecycle",
    "Lifecycle",
    "Any stage",
    adminLifecycleStages.map((value) => [value, lifecycleLabels[value]] as const),
  ),
  selectField(
    "signedUp",
    "Signed up",
    "Any time",
    adminWindowDays.map((days) => [String(days), `In the last ${days} days`] as const),
  ),
  {
    type: "select",
    label: "Activity",
    names: ["activeWithin", "inactiveFor"],
    options: [
      { label: "Any activity", params: {} },
      ...adminWindowDays.map((days) => ({
        label: `Active in the last ${days} days`,
        params: { activeWithin: String(days) },
      })),
      { label: "Inactive for 30 days or more", params: { inactiveFor: "30" } },
    ],
  },
];
