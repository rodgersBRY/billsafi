import type { AdminSupportCaseRow } from "@billsafi/contracts";
import Link from "next/link";
import { formatInstant, formatRelative } from "../admin-format";
import { ClickableRow } from "../admin-link";
import { supportCaseHref } from "../admin-params";
import { type Column, DataTable, tdClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { assigneeText } from "./support-text";

const columns: Column[] = [
  { label: "Case" },
  { label: "Status" },
  { label: "Severity", sort: "severity" },
  { label: "Category" },
  { label: "Assigned to" },
  { label: "Updated", sort: "updated" },
  { label: "Created", sort: "created" },
];

function Cards({ cases }: { cases: AdminSupportCaseRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {cases.map((row) => (
        <li key={row.id} className="p-4">
          <Link
            href={supportCaseHref(row.id)}
            className="block font-medium break-words hover:text-accent hover:underline"
          >
            {row.title}
          </Link>
          <p className="text-sm break-words text-sub">{row.account.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge kind="supportStatus" value={row.status} labelled />
            <StatusBadge kind="severity" value={row.severity} labelled />
            <StatusBadge kind="category" value={row.category} labelled />
          </div>
          <p className="mt-2 text-xs text-sub">
            {assigneeText(row.assignedTo)}. Updated {formatRelative(row.updatedAt)}.
          </p>
        </li>
      ))}
    </ul>
  );
}

interface CaseTableProps {
  cases: AdminSupportCaseRow[];
  caption?: string;
  sort?: { sort: string; dir: "asc" | "desc" };
  sortHref?: (sort: string, dir: "asc" | "desc") => string;
  /** False on a page that is already about one account. */
  showAccount?: boolean;
}

/** Cases as a table, and cards on phones. Each row opens the case. */
export function CaseTable({
  cases,
  caption = "Support cases",
  sort,
  sortHref,
  showAccount = true,
}: CaseTableProps) {
  return (
    <DataTable
      caption={caption}
      columns={columns}
      sort={sort}
      sortHref={sortHref}
      mobile={<Cards cases={cases} />}
    >
      {cases.map((row) => (
        <ClickableRow key={row.id} href={supportCaseHref(row.id)}>
          <td className={`${tdClass} max-w-80 min-w-56`}>
            <Link
              href={supportCaseHref(row.id)}
              className="font-medium break-words hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {row.title}
            </Link>
            {showAccount && (
              <>
                <p className="text-xs break-words text-sub">{row.account.name}</p>
                <p className="text-xs break-all text-sub">{row.account.email}</p>
              </>
            )}
          </td>
          <td className={tdClass}>
            <StatusBadge kind="supportStatus" value={row.status} />
          </td>
          <td className={tdClass}>
            <StatusBadge kind="severity" value={row.severity} />
          </td>
          <td className={tdClass}>
            <StatusBadge kind="category" value={row.category} />
          </td>
          <td className={`${tdClass} max-w-48 break-words`}>{assigneeText(row.assignedTo)}</td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            <time dateTime={row.updatedAt} title={formatInstant(row.updatedAt)}>
              {formatRelative(row.updatedAt)}
            </time>
          </td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            <time dateTime={row.createdAt} title={formatInstant(row.createdAt)}>
              {formatRelative(row.createdAt)}
            </time>
          </td>
        </ClickableRow>
      ))}
    </DataTable>
  );
}
