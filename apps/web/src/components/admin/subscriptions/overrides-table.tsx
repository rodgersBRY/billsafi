import type { AdminOverrideRow } from "@billsafi/contracts";
import { Undo2 } from "lucide-react";
import Link from "next/link";
import { formatCount, formatDay, formatInstant } from "../admin-format";
import { tenantHref } from "../admin-params";
import { ActionHost } from "../action-host";
import type { ConfirmAction } from "../confirm-action-dialog";
import { ConfirmButton } from "../confirm-button";
import { type Column, DataTable, tdClass, tdNowrapClass } from "../data-table";
import { StatusBadge } from "../status-badge";
import { adminText } from "./subscription-text";

const columns: Column[] = [
  { label: "Account" },
  { label: "Extra invoices", align: "right" },
  { label: "Runs" },
  { label: "State" },
  { label: "Added by and reason" },
  { label: "Revoked" },
  { label: "Actions", srOnly: true },
];

function revokeAction(row: AdminOverrideRow): ConfirmAction {
  return {
    title: "Revoke this limit override?",
    target: {
      name: row.userEmail,
      detail: `+${formatCount(row.extraInvoices)} invoices until ${formatDay(row.expiresAt)}`,
    },
    impact: [
      row.state === "active"
        ? `The account's invoice limit drops by ${formatCount(row.extraInvoices)} now.`
        : "The override won't start.",
      "It stays in the history, marked as revoked.",
    ],
    confirmLabel: "Revoke override",
    path: `/admin/overrides/${encodeURIComponent(row.id)}/revoke`,
    successMessage: "The override is revoked.",
    destructive: true,
  };
}

interface OverridesTableProps {
  overrides: AdminOverrideRow[];
  showAccount?: boolean;
}

/** Limit overrides with their state, newest first. Active and scheduled ones can be revoked. */
export function OverridesTable({ overrides, showAccount = true }: OverridesTableProps) {
  const shown = showAccount ? columns : columns.filter((column) => column.label !== "Account");
  return (
    <ActionHost>
      <DataTable caption="Limit overrides" columns={shown}>
        {overrides.map((row) => (
          <tr key={row.id} className="border-t border-line">
            {showAccount && (
              <td className={`${tdClass} max-w-64 min-w-48 break-all`}>
                <Link
                  href={tenantHref(row.userId, "subscription")}
                  className="hover:text-accent hover:underline"
                >
                  {row.userEmail}
                </Link>
              </td>
            )}
            <td className={`${tdClass} text-right tabular-nums`}>
              +{formatCount(row.extraInvoices)}
            </td>
            <td className={tdNowrapClass}>
              {formatDay(row.startsAt)} to {formatDay(row.expiresAt)}
            </td>
            <td className={tdClass}>
              <StatusBadge kind="override" value={row.state} />
            </td>
            <td className={`${tdClass} max-w-72 min-w-48`}>
              <span className="break-all">{adminText(row.createdBy)}</span>
              <span className="mt-0.5 block text-xs break-words text-sub">{row.reason}</span>
            </td>
            <td className={`${tdClass} max-w-64 min-w-40`}>
              {row.revokedAt ? (
                <>
                  {formatInstant(row.revokedAt)}
                  <span className="block text-xs break-all text-sub">
                    by {adminText(row.revokedBy)}
                  </span>
                  {row.revokeReason && (
                    <span className="block text-xs break-words text-sub">{row.revokeReason}</span>
                  )}
                </>
              ) : (
                <span className="text-sub">No</span>
              )}
            </td>
            <td className={`${tdClass} py-1.5 text-right`}>
              {(row.state === "active" || row.state === "scheduled") && (
                <ConfirmButton action={revokeAction(row)}>
                  <Undo2 aria-hidden className="size-4" />
                  Revoke
                  <span className="sr-only"> override for {row.userEmail}</span>
                </ConfirmButton>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </ActionHost>
  );
}
