import {
  accountGrantKinds,
  adminOverrideStates,
  adminSubscriptionStatuses,
  manualPaymentMethods,
  planPaymentProviders,
} from "@billsafi/contracts";
import { type FilterField, selectField } from "../filter-fields";
import { overrideStateLabels, providerLabels, subscriptionStatusLabels } from "../status-badge";
import { grantText, methodLabels } from "./subscription-text";

const search = (placeholder: string): FilterField => ({
  type: "search",
  name: "search",
  label: "Search",
  placeholder,
});
const dateRange: FilterField[] = [
  { type: "date", name: "from", label: "From" },
  { type: "date", name: "to", label: "To" },
];

export const subscriptionFilters: FilterField[] = [
  search("Owner name, email or account ID"),
  selectField(
    "subscriptionStatus",
    "Subscription",
    "Any subscription",
    adminSubscriptionStatuses.map((value) => [value, subscriptionStatusLabels[value]] as const),
  ),
  {
    type: "select",
    label: "Renewal",
    names: ["renewalWithin", "lapsedWithin"],
    options: [
      { label: "Any time", params: {} },
      { label: "Pro ends within 7 days", params: { renewalWithin: "7" } },
      { label: "Pro ends within 30 days", params: { renewalWithin: "30" } },
      { label: "Lapsed in the last 30 days", params: { lapsedWithin: "30" } },
    ],
  },
  selectField("hasOverride", "Limit override", "With or without", [
    ["true", "With an active override"],
    ["false", "Without an active override"],
  ]),
];

export const paymentFilters: FilterField[] = [
  search("Account email or ID"),
  selectField(
    "provider",
    "Source",
    "Any source",
    planPaymentProviders.map((value) => [value, providerLabels[value]] as const),
  ),
  selectField("status", "Status", "Any status", [
    ["succeeded", "Succeeded"],
    ["pending", "Pending"],
    ["failed", "Failed"],
  ]),
  selectField(
    "method",
    "Method (manual)",
    "Any method",
    manualPaymentMethods.map((value) => [value, methodLabels[value]] as const),
  ),
  selectField("stuck", "Pending", "Any pending time", [["true", "Stuck for over 10 minutes"]]),
  ...dateRange,
];

export const grantFilters: FilterField[] = [
  search("Account email or ID"),
  selectField(
    "kind",
    "Kind",
    "Pro months or credits",
    accountGrantKinds.map((value) => [value, grantText(value, 2).replace(/^2 /, "")] as const),
  ),
  ...dateRange,
];

export const overrideFilters: FilterField[] = [
  search("Account email or ID"),
  selectField(
    "state",
    "State",
    "Any state",
    adminOverrideStates.map((value) => [value, overrideStateLabels[value]] as const),
  ),
  selectField("endingWithin", "Ending", "Any time", [["7", "Ending within 7 days"]]),
];
