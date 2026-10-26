import { ArrowRight, CircleAlert, CircleCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { formatCount } from "../admin-format";

export interface AttentionItem {
  label: string;
  count: number;
  /** What the count means and why it matters. */
  help: string;
  href: string;
}

/** Counts that need a look, each linking to the filtered list behind it. */
export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <section
      aria-labelledby="attention-title"
      className="min-w-0 rounded-panel border border-line bg-panel"
    >
      <h2 id="attention-title" className="px-4 pt-4 text-base font-semibold">
        Needs attention
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {items.map((item) => {
          const Icon: LucideIcon = item.count > 0 ? CircleAlert : CircleCheck;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex min-h-11 items-start gap-3 px-4 py-3 hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <Icon
                  aria-hidden
                  className={`mt-0.5 size-4 shrink-0 ${item.count > 0 ? "text-amber-700 dark:text-amber-300" : "text-accent"}`}
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
          );
        })}
      </ul>
    </section>
  );
}
