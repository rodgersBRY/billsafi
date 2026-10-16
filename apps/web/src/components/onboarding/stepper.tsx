import { Check } from "lucide-react";

const STEPS = ["Your account", "Your business", "Payment details"] as const;

/** `current` is 1-based; steps before it render as complete. */
export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="Setup progress">
      <ol className="flex justify-between gap-3 md:grid md:content-start md:gap-6 md:pt-2.5">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`flex flex-col items-center gap-1.5 text-center text-xs sm:flex-row sm:gap-3 sm:text-left sm:text-base ${
                active || done ? "text-ink" : "text-sub"
              }`}
            >
              <span
                className={`grid size-7.5 shrink-0 md:size-8.5 place-items-center rounded-full border ${
                  active || done ? "border-teal bg-teal text-white" : "border-line"
                }`}
              >
                {done ? <Check aria-hidden className="size-4" /> : step}
              </span>
              {label}
              {done && <span className="sr-only">(complete)</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
