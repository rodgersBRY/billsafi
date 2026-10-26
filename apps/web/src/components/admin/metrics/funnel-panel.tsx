import type { AdminFunnel, AdminFunnelStep, AdminFunnelStepKey } from "@billsafi/contracts";
import { formatCount, formatDay, formatDuration, formatShare } from "../admin-format";
import { UpdatedAt } from "../admin-ui";

const stepLabels: Record<AdminFunnelStepKey, string> = {
  signed_up: "Signed up",
  business_created: "Created a business",
  client_added: "Added a client",
  invoice_created: "Created an invoice",
  invoice_ready: "Made an invoice Ready",
  payment_recorded: "Recorded a payment",
};

function dropText(drop: number | null): string | null {
  if (drop === null) return null;
  if (drop < 0) return `${formatShare(-drop)} more than the step before`;
  return `${formatShare(drop)} drop from the step before`;
}

function StepRow({ step }: { step: AdminFunnelStep }) {
  const width = Math.min(Math.max(step.shareOfSignups ?? 0, 0), 1) * 100;
  const drop = dropText(step.dropFromPrevious);
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium">{stepLabels[step.key]}</p>
        <p className="text-sm tabular-nums">
          {formatCount(step.users)}{" "}
          <span className="text-sub">({formatShare(step.shareOfSignups)})</span>
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-soft">
        <div className="h-full rounded-full bg-teal" style={{ width: `${width}%` }} />
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-sub">
        {drop && <span>{drop}</span>}
        {step.key !== "signed_up" && (
          <span>Median time from sign-up: {formatDuration(step.medianSecondsFromSignup)}</span>
        )}
      </p>
    </li>
  );
}

export function FunnelPanel({ data }: { data: AdminFunnel }) {
  return (
    <section aria-labelledby="funnel-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="funnel-title" className="text-lg font-semibold">
            Activation funnel
          </h2>
          <p className="text-sm text-sub">People who signed up since {formatDay(data.since)}.</p>
        </div>
      </div>
      <section className="rounded-panel border border-line bg-panel p-4 sm:p-5">
        <ol className="space-y-5">
          {data.steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ol>
      </section>
      <p className="text-xs text-sub">
        Each step counts everyone in the window who reached it, whether or not they reached the
        steps above it. That is why a step can have more people than the one before.
      </p>
      <UpdatedAt iso={data.generatedAt} />
    </section>
  );
}
