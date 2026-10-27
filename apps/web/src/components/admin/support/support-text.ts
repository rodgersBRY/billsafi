import type { AdminSupportPerson } from "@billsafi/contracts";

export const assigneeText = (person: AdminSupportPerson | null) =>
  person ? person.name || person.email : "Nobody";

/** Plain-English names for the audit actions on a case timeline. */
export const timelineActionLabels: Record<string, string> = {
  "support.case_create": "Opened the case",
  "support.case_update": "Changed the case",
  "support.case_resolve": "Resolved the case",
  "support.case_reopen": "Reopened the case",
};

export const changeFieldLabels: Record<string, string> = {
  title: "Title",
  category: "Category",
  severity: "Severity",
  status: "Status",
  assignedTo: "Assignee",
};
