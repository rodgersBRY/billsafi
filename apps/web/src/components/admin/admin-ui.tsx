import type { SubscriptionPaymentStatus } from "@billsafi/contracts";
import { CircleCheck, CircleX, Clock, Inbox, type LucideIcon, SkipBack } from "lucide-react";
import Link from "next/link";
import { AdminLink } from "./admin-link";

interface PanelProps {
  title: string;
  description?: string;
  id?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** A titled panel whose content scrolls sideways instead of stretching the page. */
export function Panel({ title, description, id, actions, children }: PanelProps) {
  return (
    <section id={id} className="min-w-0 scroll-mt-20 rounded-panel border border-line bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-sub">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="overflow-x-auto border-t border-line">{children}</div>
    </section>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

/** Nothing to show. Kept visibly apart from errors: a calm icon and a next step. */
export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center gap-2 px-4 py-10 text-center">
      <Icon aria-hidden className="size-7 text-sub" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-sub">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <p className="p-5 text-sm text-sub">{text}</p>;
}

/** A page number beyond the last page, from an old link or rows that went away. */
export function PastEndState({ firstPageHref }: { firstPageHref: string }) {
  return (
    <EmptyState
      icon={SkipBack}
      title="This page is past the end"
      description="There are fewer results than this page needs."
      action={
        <Link href={firstPageHref} className="text-sm text-accent hover:underline">
          Go to page 1
        </Link>
      }
    />
  );
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
          className="inline-flex min-h-11 items-center rounded-sm px-3 py-1.5 text-sm text-sub md:min-h-0 hover:text-ink aria-[current=page]:bg-soft aria-[current=page]:font-medium aria-[current=page]:text-accent"
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

const paymentIcons: Record<SubscriptionPaymentStatus, LucideIcon> = {
  pending: Clock,
  succeeded: CircleCheck,
  failed: CircleX,
};

export function PaymentStatusPill({ status }: { status: SubscriptionPaymentStatus }) {
  const Icon = paymentIcons[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.75 py-1 text-xs ${paymentTones[status]}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {paymentLabels[status]}
    </span>
  );
}

const timeFormat = new Intl.DateTimeFormat("en-KE", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Africa/Nairobi",
});

/**
 * When the API worked the figures out. Cached lists and metrics are kept for up to a
 * minute; pass `cached={false}` for details and the audit log, which are always fresh.
 */
export function UpdatedAt({ iso, cached = true }: { iso: string; cached?: boolean }) {
  return (
    <p className="text-xs text-sub">
      Last updated <time dateTime={iso}>{timeFormat.format(new Date(iso))}</time> Nairobi time.
      {cached && " Figures refresh at most once a minute."}
    </p>
  );
}
