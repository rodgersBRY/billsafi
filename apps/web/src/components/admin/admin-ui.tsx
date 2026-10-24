import type { SubscriptionPaymentStatus } from "@billsafi/contracts";
import { AdminLink } from "./admin-link";

export const thClass = "px-4 py-3 font-normal whitespace-nowrap";
export const tdClass = "px-4 py-3.5 whitespace-nowrap";
export const theadClass = "bg-background text-left text-xs text-sub";

interface PanelProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** A titled panel whose content scrolls sideways instead of stretching the page. */
export function Panel({ title, description, children }: PanelProps) {
  return (
    <section className="min-w-0 rounded-panel border border-line bg-panel">
      <div className="px-4 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-sub">{description}</p>}
      </div>
      <div className="overflow-x-auto border-t border-line">{children}</div>
    </section>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <p className="p-5 text-sm text-sub">{text}</p>;
}

interface SwitchOption {
  label: string;
  href: string;
  current: boolean;
}

/** A small segmented control, like 7 / 30 / 90 days. */
export function PeriodSwitch({ label, options }: { label: string; options: SwitchOption[] }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-panel border border-line bg-panel p-0.5">
      {options.map((option) => (
        <AdminLink
          key={option.href}
          href={option.href}
          current={option.current}
          replace
          className="rounded-sm px-3 py-1.5 text-sm text-sub hover:text-ink aria-[current=page]:bg-soft aria-[current=page]:font-medium aria-[current=page]:text-accent"
        >
          {option.label}
        </AdminLink>
      ))}
    </nav>
  );
}

const paymentTones: Record<SubscriptionPaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  succeeded: "bg-soft text-accent",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

const paymentLabels: Record<SubscriptionPaymentStatus, string> = {
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
};

export function PaymentStatusPill({ status }: { status: SubscriptionPaymentStatus }) {
  return (
    <span className={`inline-block rounded-md px-1.75 py-1 text-xs ${paymentTones[status]}`}>
      {paymentLabels[status]}
    </span>
  );
}

const timeFormat = new Intl.DateTimeFormat("en-KE", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

/** When the API worked the figures out; it keeps them for up to a minute. */
export function UpdatedAt({ iso }: { iso: string }) {
  return (
    <p className="text-xs text-sub">
      Figures as of <time dateTime={iso}>{timeFormat.format(new Date(iso))}</time> Nairobi time.
      They refresh at most once a minute.
    </p>
  );
}
