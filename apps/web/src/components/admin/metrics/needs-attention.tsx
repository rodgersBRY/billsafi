import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import { formatCount } from "../admin-format";

export interface AttentionItem {
  label: string;
  count: number;
  /** What the count means and why it matters. */
  help: string;
  href: string;
}

/** Only the counts above zero, each linking to the list behind it; one quiet line when all clear. */
export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  const open = items.filter((item) => item.count > 0);
  if (open.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-sm text-sub">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-accent" />
        Nothing needs you right now.
      </p>
    );
  }
  return (
    <section aria-labelledby="attention-title" className="min-w-0 space-y-2">
      <h2 id="attention-title" className="text-base font-semibold">
        Needs attention
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {open.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex min-h-11 items-start gap-3 rounded-panel border border-line bg-panel px-4 py-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <CircleAlert
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="font-semibold tabular-nums">{formatCount(item.count)}</span>
                </span>
                <span className="mt-0.5 block text-xs text-sub">{item.help}</span>
              </span>
              <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-sub" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
