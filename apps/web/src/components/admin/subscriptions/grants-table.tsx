import type { AdminGrantRow } from "@billsafi/contracts";
import Link from "next/link";
import { formatDay, formatInstant } from "../admin-format";
import { tenantHref } from "../admin-params";
import { type Column, DataTable, tdClass, tdNowrapClass } from "../data-table";
import { EndedEarly } from "./payments-table";
import { adminText, grantText } from "./subscription-text";

const columns: Column[] = [
  { label: "Date" },
  { label: "Account" },
  { label: "Gift" },
  { label: "Pro window" },
  { label: "Granted by" },
  { label: "Reason" },
];

/** The Pro access a gift added, or that it was dropped before it began. */
function GrantWindow({ grant }: { grant: AdminGrantRow }) {
  if (!grant.grantedFrom || !grant.grantedUntil) return <span className="text-sub">None</span>;
  if (grant.endedEarly && grant.grantedUntil <= grant.grantedFrom) {
    return (
      <>
        Dropped before it began
        <EndedEarly />
      </>
    );
  }
  return (
    <>
      {formatDay(grant.grantedFrom)} to {formatDay(grant.grantedUntil)}
      {grant.endedEarly && <EndedEarly />}
    </>
  );
}

/** Complimentary Pro months and credits, newest first. Gifts are never revenue. */
export function GrantsTable({
  grants,
  showAccount = true,
}: {
  grants: AdminGrantRow[];
  showAccount?: boolean;
}) {
  const shown = showAccount ? columns : columns.filter((column) => column.label !== "Account");
  return (
    <DataTable caption="Complimentary grants" columns={shown}>
      {grants.map((grant) => (
        <tr key={grant.id} className="border-t border-line">
          <td className={tdNowrapClass}>{formatInstant(grant.createdAt)}</td>
          {showAccount && (
            <td className={`${tdClass} max-w-64 min-w-48 break-all`}>
              <Link
                href={tenantHref(grant.userId, "subscription")}
                className="hover:text-accent hover:underline"
              >
                {grant.userEmail}
              </Link>
            </td>
          )}
          <td className={tdNowrapClass}>{grantText(grant.kind, grant.quantity)}</td>
          <td className={tdNowrapClass}>
            <GrantWindow grant={grant} />
          </td>
          <td className={`${tdClass} max-w-64 min-w-48 break-all`}>{adminText(grant.grantedBy)}</td>
          <td className={`${tdClass} max-w-72 min-w-48 break-words`}>{grant.reason}</td>
        </tr>
      ))}
    </DataTable>
  );
}
