import { supportCategories, supportSeverities } from "@billsafi/contracts";
import { type FilterField, selectField } from "../filter-fields";
import { categoryLabels, severityLabels } from "../status-badge";

/** The Support list filters. The tabs already cover status. */
export const supportFilters: FilterField[] = [
  {
    type: "search",
    name: "search",
    label: "Search",
    placeholder: "Title, account name or email, or ID",
  },
  selectField(
    "severity",
    "Severity",
    "Any severity",
    supportSeverities.map((value) => [value, severityLabels[value]] as const),
  ),
  selectField(
    "category",
    "Category",
    "Any category",
    supportCategories.map((value) => [value, categoryLabels[value]] as const),
  ),
];
