import { CalendarClock, type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  phase: number;
  icon?: LucideIcon;
  /** What the page will show once it ships. */
  planned: string[];
  /** What Billsafi can't show here yet, and why. */
  unavailable?: string[];
}

/** A clearly marked deferred module: what it will hold and when, with no sample data. */
export function ComingSoon({
  phase,
  icon: Icon = CalendarClock,
  planned,
  unavailable,
}: ComingSoonProps) {
  return (
    <section className="rounded-panel border border-dashed border-line bg-panel p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-soft text-accent">
          <Icon aria-hidden className="size-5" />
        </span>
        <div>
          <p className="text-xs font-medium tracking-wide text-sub uppercase">Not built yet</p>
          <h2 className="text-base font-semibold">Coming in phase {phase}</h2>
        </div>
      </div>
      <h3 className="mt-5 text-sm font-medium">What this page will show</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-sub">
        {planned.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {unavailable && unavailable.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-medium">Not available, and why</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-sub">
            {unavailable.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
