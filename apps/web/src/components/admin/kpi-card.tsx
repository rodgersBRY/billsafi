import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";

export interface KpiChange {
  direction: "up" | "down" | "flat";
  /** The change in words, such as "up 12% from 41". */
  text: string;
}

interface KpiCardProps {
  label: string;
  /** Null when the figure is not available; shown as a dash, never as 0. */
  value: string | null;
  /** One line on what the figure counts. */
  definition: string;
  /** How the figure moved since the previous period. */
  change?: KpiChange;
  /** Extra facts under the figure, such as the counts behind a rate or why it is missing. */
  detail?: string;
  href?: string;
}

const changeIcons = { up: ArrowUp, down: ArrowDown, flat: Minus };

/** A single headline figure with its definition. */
export function KpiCard({ label, value, definition, change, detail, href }: KpiCardProps) {
  const ChangeIcon = change ? changeIcons[change.direction] : null;
  const body = (
    <>
      <p className="text-sm text-sub">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
        {value ?? (
          <>
            <span aria-hidden>—</span>
            <span className="sr-only">Not available</span>
          </>
        )}
      </p>
      {change && ChangeIcon && (
        <p className="mt-1 flex items-start gap-1 text-xs font-medium">
          <ChangeIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{change.text}</span>
        </p>
      )}
      {detail && <p className="mt-1 text-xs">{detail}</p>}
      <p className="mt-1.5 text-xs text-sub">{definition}</p>
    </>
  );
  const card = "block h-full rounded-panel border border-line bg-panel p-4";
  return href ? (
    <Link
      href={href}
      className={`${card} hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  );
}
