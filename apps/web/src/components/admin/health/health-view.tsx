import type { AdminHealth, AdminHealthIndicator } from "@billsafi/contracts";
import {
  ArrowRight,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  ExternalLink,
  Link2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { formatCount, formatDuration, formatInstant, formatRelative } from "../admin-format";
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

const statusOrder: AdminHealthIndicator["status"][] = ["failing", "warning", "ok", "unknown"];

/** Problems first: failing, then warning, then ok, then unknown. Keeps the API order within a group. */
export function sortIndicators(indicators: AdminHealthIndicator[]): AdminHealthIndicator[] {
  return [...indicators].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status),
  );
}

const summaryTone: Record<AdminHealthIndicator["status"], string> = {
  ok: "text-emerald-800 dark:text-emerald-200",
  warning: "text-amber-900 dark:text-amber-200",
  failing: "text-red-800 dark:text-red-200",
  unknown: "text-sub",
};

const summaryIcon = {
  ok: CircleCheck,
  warning: TriangleAlert,
  failing: CircleX,
  unknown: CircleHelp,
};

/** The one-line wording for the whole page, and the worst status that sets its color. */
export function summarize(indicators: AdminHealthIndicator[]): {
  status: AdminHealthIndicator["status"];
  text: string;
} {
  const count = (status: AdminHealthIndicator["status"]) =>
    indicators.filter((indicator) => indicator.status === status).length;
  const failing = count("failing");
  const warning = count("warning");
  const ok = count("ok");
  const unknown = count("unknown");
  const status =
    statusOrder.find((s) => count(s) > 0 && (s !== "unknown" || ok === 0)) ?? "unknown";
  const parts: string[] = [];
  if (failing > 0) parts.push(`${failing} failing`);
  if (warning > 0) parts.push(`${warning} ${warning === 1 ? "warning" : "warnings"}`);
  if (parts.length === 0) {
    if (unknown === 0) return { status: "ok", text: "All checks passing" };
    if (ok === 0) return { status: "unknown", text: "No data yet" };
    return {
      status: "unknown",
      text: `${ok} ${ok === 1 ? "check" : "checks"} passing, ${unknown} unknown`,
    };
  }
  return { status, text: parts.join(", ") };
}

/** One line for the whole page: the worst status as an icon and words. */
export function HealthSummary({ indicators }: { indicators: AdminHealthIndicator[] }) {
  const { status, text } = summarize(indicators);
  const Icon = summaryIcon[status];
  return (
    <p
      role="status"
      className={`mb-4 flex items-center gap-2 text-base font-semibold ${summaryTone[status]}`}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      {text}
    </p>
  );
}

/** Indicators that have no data to show, by key, with the short value for each. */
const emptyValues: Record<string, string> = {
  mpesa: "No checkouts yet",
  migrations: "Not available",
  billing_jobs: "Not running",
  pdf_email: "No data yet",
  backups: "No backup yet",
};

function unknownValue(indicator: AdminHealthIndicator): string {
  return emptyValues[indicator.key] ?? "No data yet";
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
          {unknown ? unknownValue(indicator) : "No figure"}
        </p>
      )}
      {indicator.key === "pdf_email" && indicator.data && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
          <span>
            <span className="text-sub">PDF </span>
            {formatCount(indicator.data.pdf ?? 0)}
          </span>
          <span>
            <span className="text-sub">Email </span>
            {formatCount(indicator.data.email ?? 0)}
          </span>
          <span className="text-sub">last 24 hours</span>
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
      {indicator.key === "pdf_email" && (
        <Link
          href="/admin/health#recent-failures"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0"
        >
          Recent failures
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
      {indicator.key !== "pdf_email" && indicator.href?.startsWith("/") && (
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
      {sortIndicators(health.indicators).map((indicator) => (
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
