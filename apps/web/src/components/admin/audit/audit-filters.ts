import { adminAuditOutcomes } from "@billsafi/contracts";
import { type FilterField, selectField } from "../filter-fields";
import { outcomeLabels } from "../status-badge";
import { auditActionLabels, auditTargetLabels } from "./audit-labels";

/** The audit log filters (spec section 22.8). Dates are Nairobi calendar days. */
export const auditFilters: FilterField[] = [
  selectField("action", "Action", "Any action", Object.entries(auditActionLabels)),
  selectField("targetType", "Target type", "Any target", Object.entries(auditTargetLabels)),
  selectField(
    "outcome",
    "Outcome",
    "Any outcome",
    adminAuditOutcomes.map((value) => [value, outcomeLabels[value]] as const),
  ),
  { type: "date", name: "from", label: "From (Nairobi date)" },
  { type: "date", name: "to", label: "To (Nairobi date)" },
  { type: "text", name: "actorId", label: "Actor ID", placeholder: "Admin user ID" },
  { type: "text", name: "targetId", label: "Target ID", placeholder: "Account or user ID" },
];
