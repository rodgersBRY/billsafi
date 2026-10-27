import {
  type AdminTenantBusiness,
  invoiceStatusLabels,
  invoiceStatuses,
} from "@billsafi/contracts";
import { Image as ImageIcon, ImageOff, Store } from "lucide-react";
import { formatBytes, formatCount, formatDay } from "../admin-format";
import { EmptyState, Panel } from "../admin-ui";
import { type Column, DataTable, tdClass } from "../data-table";

const columns: Column[] = [
  { label: "Business" },
  { label: "Created" },
  { label: "Contact" },
  { label: "Clients", align: "right" },
  ...invoiceStatuses.map((status) => ({
    label: invoiceStatusLabels[status],
    align: "right" as const,
  })),
  { label: "Logo" },
];

/** The account's business profiles. Operational counts only, no invoice contents. */
export function TenantBusinessesTab({ businesses }: { businesses: AdminTenantBusiness[] }) {
  return (
    <Panel
      title="Businesses"
      description="Invoice counts by status. Phone numbers are partly hidden."
    >
      {businesses.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No businesses yet"
          description="The owner hasn't finished onboarding."
        />
      ) : (
        <DataTable caption="Businesses" columns={columns}>
          {businesses.map((business) => (
            <tr key={business.id} className="border-t border-line">
              <td className={`${tdClass} max-w-56`}>
                <p className="font-medium break-words">{business.displayName}</p>
                <p className="text-xs text-sub">
                  {business.profileType === "individual" ? "Individual" : "Business"}
                </p>
              </td>
              <td className={`${tdClass} whitespace-nowrap text-sub`}>
                {formatDay(business.createdAt)}
              </td>
              <td className={tdClass}>
                <p className="break-all">{business.contactEmail}</p>
                <p className="text-xs whitespace-nowrap text-sub tabular-nums">{business.phone}</p>
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {formatCount(business.clients)}
              </td>
              {invoiceStatuses.map((status) => (
                <td key={status} className={`${tdClass} text-right tabular-nums`}>
                  {formatCount(business.invoices[status] ?? 0)}
                </td>
              ))}
              <td className={`${tdClass} whitespace-nowrap`}>
                {business.hasLogo ? (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon aria-hidden className="size-4 text-sub" />
                    Yes
                    {business.logoBytes !== null && (
                      <span className="text-xs text-sub">({formatBytes(business.logoBytes)})</span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sub">
                    <ImageOff aria-hidden className="size-4" />
                    No
                  </span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
