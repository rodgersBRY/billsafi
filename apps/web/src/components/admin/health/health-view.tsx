import type { AdminHealth, AdminHealthIndicator } from "@billsafi/contracts";
import { ArrowRight, ExternalLink, Link2, Clock } from "lucide-react";
import Link from "next/link";
import { formatDuration, formatInstant, formatRelative } from "../admin-format";
import { StatusBadge } from "../status-badge";

const cardTone: Record<AdminHealthIndicator["status"], string> = {
  ok: "border-line",
  unknown: "border-line",
  warning: "border-amber-300 dark:border-amber-700",
  failing: "border-red-300 dark:border-red-700",
};

/** True when the fact is older than the indicator says it can be trusted for. */
export function isStale(indicator: AdminHealthIndicator, now: number): boolean {
  if (indicator.staleAfterSeconds === null) return false;
  return now - new Date(indicator.checkedAt).getTime() > indicator.staleAfterSeconds * 1000;
}

/** One pill per indicator, each jumping to its card. */
export function StatusStrip({ indicators }: { indicators: AdminHealthIndicator[] }) {
  return (
    <ul aria-label="Status of each check" className="mb-4 flex flex-wrap gap-2">
      {indicators.map((indicator) => (
        <li key={indicator.key}>
          <a
            href={`#health-${indicator.key}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-line bg-panel px-3 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-9"
          >
            <span className="font-medium">{indicator.label}</span>
            <StatusBadge kind="health" value={indicator.status} />
          </a>
        </li>
      ))}
    </ul>
  );
}

function IndicatorCard({ indicator, now }: { indicator: AdminHealthIndicator; now: number }) {
  const stale = isStale(indicator, now);
  const unknown = indicator.status === "unknown";
  return (
    <li
      id={`health-${indicator.key}`}
      className={`flex min-w-0 scroll-mt-20 flex-col gap-3 rounded-panel border bg-panel p-4 ${cardTone[indicator.status]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-medium">{indicator.label}</h3>
        <StatusBadge kind="health" value={indicator.status} labelled />
      </div>
      {indicator.value ? (
        <p className="text-xl font-semibold tracking-tight break-words">{indicator.value}</p>
      ) : (
        <p className={unknown ? "text-sm text-sub" : "text-sm"}>
          {unknown ? "Not recorded yet" : "No figure"}
        </p>
      )}
      <p className="text-sm break-words text-sub">{indicator.detail}</p>
      {stale && indicator.staleAfterSeconds !== null && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
          <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Out of date. Last recorded {formatRelative(indicator.checkedAt)}, and it should be no
          older than {formatDuration(indicator.staleAfterSeconds)}.
        </p>
      )}
      <p className="mt-auto text-xs text-sub">
        <time dateTime={indicator.checkedAt} title={formatInstant(indicator.checkedAt)}>
          Checked {formatRelative(indicator.checkedAt)}
        </time>
        {" · "}
        {indicator.source}
      </p>
      {indicator.href?.startsWith("/") && (
        <Link
          href={indicator.href}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0"
        >
          View details
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </li>
  );
}

export function IndicatorGrid({ health, now }: { health: AdminHealth; now: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {health.indicators.map((indicator) => (
        <IndicatorCard key={indicator.key} indicator={indicator} now={now} />
      ))}
    </ul>
  );
}

/** Where the real availability and error figures live. Hidden when no link is set. */
export function HealthLinks({ links }: { links: AdminHealth["links"] }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="health-links" className="mt-6">
      <h2 id="health-links" className="mb-3 text-base font-semibold">
        Monitoring tools
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-start gap-3 rounded-panel border border-line bg-panel p-4 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {link.label}
                  <ExternalLink aria-hidden className="size-3.5 text-sub" />
                  <span className="sr-only">(opens in a new tab)</span>
                </span>
                <span className="mt-0.5 block text-sm text-sub">{link.description}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
