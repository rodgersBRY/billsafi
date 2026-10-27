import { adminAccountStatuses, adminRoles, adminSignInMethods } from "@billsafi/contracts";
import { type FilterField, selectField } from "../filter-fields";
import { accountStatusLabels, roleLabels } from "../status-badge";
import { signInMethodLabels } from "./user-text";

/** The users directory filters (spec section 22.4). */
export const userFilters: FilterField[] = [
  { type: "search", name: "search", label: "Search", placeholder: "Name, email or user ID" },
  selectField(
    "role",
    "Role",
    "Any role",
    adminRoles.map((value) => [value, roleLabels[value]] as const),
  ),
  selectField(
    "accountStatus",
    "Account status",
    "Any account status",
    adminAccountStatuses.map((value) => [value, accountStatusLabels[value]] as const),
  ),
  selectField(
    "signInMethod",
    "Sign-in method",
    "Any method",
    adminSignInMethods.map((value) => [value, signInMethodLabels[value]] as const),
  ),
];
