import { failedSignInMethods } from "@billsafi/contracts";
import { type FilterField, selectField } from "../filter-fields";
import { signInReasonLabels } from "../status-badge";

export const methodLabels = { password: "Email and password", google: "Google" } as const;

const rangeOptions = [
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["12m", "Last 12 months"],
] as const;

/** Failed sign-in filters. The range is Last 7 days unless the URL names another. */
export const failedSignInFilters: FilterField[] = [
  { type: "search", name: "email", label: "Email", placeholder: "Part of an email" },
  selectField(
    "method",
    "Method",
    "Any method",
    failedSignInMethods.map((value) => [value, methodLabels[value]] as const),
  ),
  selectField("reason", "Reason", "Any reason", Object.entries(signInReasonLabels)),
  {
    type: "select",
    label: "Range",
    names: ["range"],
    options: [
      { label: "Last 7 days", params: {} },
      ...rangeOptions.map(([value, label]) => ({ label, params: { range: value } })),
    ],
  },
];
