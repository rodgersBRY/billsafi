import Link from "next/link";

interface KpiCardProps {
  label: string;
  /** Null when the figure is not available; shown as a dash, never as 0. */
  value: string | null;
  /** One line on what the figure counts. */
  definition: string;
  href?: string;
}

/** A single headline figure with its definition. */
export function KpiCard({ label, value, definition, href }: KpiCardProps) {
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
