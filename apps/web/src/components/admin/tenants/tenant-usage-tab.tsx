import type { AdminTenantUsage } from "@billsafi/contracts";
import { formatBytes, formatCount, formatDay } from "../admin-format";
import { KpiCard } from "../kpi-card";
import { Panel } from "../admin-ui";

/** The allowance in force now, credits, totals and storage. */
export function TenantUsageTab({ usage }: { usage: AdminTenantUsage }) {
  const { allowance } = usage;
  const share = allowance.limit > 0 ? Math.min(allowance.used / allowance.limit, 1) : 0;
  const plan = allowance.plan === "pro" ? "Pro period" : "Free month";
  const totals = [
    { label: "Invoices created", value: usage.invoicesCreated, definition: "All time." },
    { label: "Invoices made Ready", value: usage.invoicesReady, definition: "All time." },
    { label: "Clients", value: usage.clients, definition: "Across every business." },
    { label: "Share links", value: usage.shareLinks, definition: "Public invoice links made." },
    {
      label: "Payments recorded",
      value: usage.paymentsRecorded,
      definition: "Invoice payments not reversed.",
    },
    {
      label: "Invoice credits",
      value: usage.credits,
      definition: "Bought and not used yet. They don't expire.",
    },
  ];

  return (
    <div className="space-y-4">
      <Panel
        title="Allowance"
        description={`${plan} from ${formatDay(allowance.periodStart)} to ${formatDay(allowance.periodEnd)}.`}
      >
        <div className="p-4">
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">
              {formatCount(allowance.used)}
            </span>{" "}
            <span className="text-sub">of {formatCount(allowance.limit)} invoices used</span>
          </p>
          <div
            role="meter"
            aria-label="Allowance used"
            aria-valuemin={0}
            aria-valuemax={allowance.limit}
            aria-valuenow={Math.min(allowance.used, allowance.limit)}
            className="mt-3 h-3 overflow-hidden rounded-full bg-soft"
          >
            <div
              className={`h-full rounded-full ${share >= 1 ? "bg-amber-600" : "bg-teal"}`}
              style={{ width: `${share * 100}%` }}
            />
          </div>
          {share >= 1 && (
            <p className="mt-2 text-xs text-sub">
              The allowance is used up. Further invoices use credits, if any.
            </p>
          )}
        </div>
      </Panel>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {totals.map((item) => (
          <li key={item.label}>
            <KpiCard
              label={item.label}
              value={formatCount(item.value)}
              definition={item.definition}
            />
          </li>
        ))}
        <li>
          <KpiCard
            label="Storage"
            value={formatBytes(usage.storageBytes)}
            definition="Every logo uploaded, old ones included, since issued invoices keep them."
          />
        </li>
      </ul>
    </div>
  );
}
