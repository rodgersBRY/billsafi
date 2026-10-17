import type { AllowanceUsage } from "@tallynest/contracts";

/** Account-wide Free allowance (D019), shown in the sidebar like the approved dashboard. */
export function UsageMeter({ usage }: { usage: AllowanceUsage }) {
  const percent = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  return (
    <div className="mt-auto border-t border-line px-2.5 pt-4">
      <p className="text-xs text-sub">Free plan</p>
      <div
        role="progressbar"
        aria-label="Invoices used this month"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        className="my-2.5 h-1.25 rounded-lg bg-line"
      >
        <div className="h-full rounded-lg bg-teal" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-sub">
        {usage.used} of {usage.limit} invoices this month
      </p>
    </div>
  );
}
