import type {
  AdminCurrentMonthSource,
  AdminOverrideState,
  PlanPaymentProvider,
  AdminAccountStatus,
  AdminAuditOutcome,
  AdminLifecycleStage,
  AdminRole,
  AdminSubscriptionStatus,
} from "@billsafi/contracts";
import {
  Ban,
  CalendarClock,
  Gift,
  HandCoins,
  Hourglass,
  Smartphone,
  Undo2,
  Wallet,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Crown,
  type LucideIcon,
  Moon,
  Rocket,
  ShieldCheck,
  Sprout,
  User,
  UserPlus,
} from "lucide-react";

/*
 * One badge for every status the admin shows. Each variant has its own text and icon,
 * so the meaning never rests on colour alone. Tones follow the spec: green for healthy,
 * amber for attention, red for blocked or failed, neutral for information.
 */

type Tone = "good" | "warn" | "bad" | "info" | "neutral";

const tones: Record<Tone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  bad: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  neutral: "border-line bg-background text-sub",
};

interface Variant {
  label: string;
  icon: LucideIcon;
  tone: Tone;
}

const account: Record<AdminAccountStatus, Variant> = {
  active: { label: "Active", icon: CircleCheck, tone: "good" },
  suspended: { label: "Suspended", icon: Ban, tone: "bad" },
};

const subscription: Record<AdminSubscriptionStatus, Variant> = {
  free: { label: "Free", icon: CircleDashed, tone: "neutral" },
  pro: { label: "Pro", icon: Crown, tone: "good" },
  pro_ending: { label: "Pro ending", icon: Clock, tone: "warn" },
  lapsed: { label: "Lapsed", icon: CircleX, tone: "warn" },
};

const lifecycle: Record<AdminLifecycleStage, Variant> = {
  registered: { label: "Registered", icon: UserPlus, tone: "neutral" },
  onboarding: { label: "Onboarding", icon: Sprout, tone: "info" },
  activated: { label: "Activated", icon: Rocket, tone: "good" },
  subscribed: { label: "Subscribed", icon: Crown, tone: "good" },
  inactive: { label: "Inactive", icon: Moon, tone: "warn" },
};

const outcome: Record<AdminAuditOutcome, Variant> = {
  success: { label: "Success", icon: CircleCheck, tone: "good" },
  failure: { label: "Failed", icon: CircleX, tone: "bad" },
};

const role: Record<AdminRole, Variant> = {
  user: { label: "User", icon: User, tone: "neutral" },
  admin: { label: "Admin", icon: ShieldCheck, tone: "info" },
};

const source: Record<AdminCurrentMonthSource, Variant> = {
  paid: { label: "Paid", icon: Wallet, tone: "good" },
  complimentary: { label: "Complimentary", icon: Gift, tone: "info" },
};

const override: Record<AdminOverrideState, Variant> = {
  scheduled: { label: "Scheduled", icon: CalendarClock, tone: "info" },
  active: { label: "Active", icon: CircleCheck, tone: "good" },
  expired: { label: "Expired", icon: Hourglass, tone: "neutral" },
  revoked: { label: "Revoked", icon: Undo2, tone: "neutral" },
};

const provider: Record<PlanPaymentProvider, Variant> = {
  mpesa: { label: "M-Pesa checkout", icon: Smartphone, tone: "neutral" },
  manual: { label: "Recorded manually", icon: HandCoins, tone: "info" },
};

export const statusVariants = {
  account,
  subscription,
  lifecycle,
  outcome,
  role,
  source,
  override,
  provider,
};

export const accountStatusLabels = labels(account);
export const subscriptionStatusLabels = labels(subscription);
export const lifecycleLabels = labels(lifecycle);
export const outcomeLabels = labels(outcome);
export const roleLabels = labels(role);
export const overrideStateLabels = labels(override);
export const providerLabels = labels(provider);

function labels<K extends string>(variants: Record<K, Variant>): Record<K, string> {
  return Object.fromEntries(
    Object.entries<Variant>(variants).map(([key, variant]) => [key, variant.label]),
  ) as Record<K, string>;
}

type BadgeProps =
  | { kind: "account"; value: AdminAccountStatus }
  | { kind: "subscription"; value: AdminSubscriptionStatus }
  | { kind: "lifecycle"; value: AdminLifecycleStage }
  | { kind: "outcome"; value: AdminAuditOutcome }
  | { kind: "role"; value: AdminRole }
  | { kind: "source"; value: AdminCurrentMonthSource }
  | { kind: "override"; value: AdminOverrideState }
  | { kind: "provider"; value: PlanPaymentProvider };

const kindNames: Record<BadgeProps["kind"], string> = {
  account: "Account",
  subscription: "Subscription",
  lifecycle: "Lifecycle",
  outcome: "Outcome",
  role: "Role",
  source: "Current month",
  override: "Override",
  provider: "Source",
};

/** A status as text plus icon. `labelled` adds the dimension name for screen readers. */
export function StatusBadge(props: BadgeProps & { labelled?: boolean }) {
  const variants = statusVariants[props.kind] as Record<string, Variant>;
  const variant = variants[props.value] ?? {
    label: props.value,
    icon: CircleDot,
    tone: "neutral" as const,
  };
  const Icon = variant.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[variant.tone]}`}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {props.labelled && <span className="sr-only">{kindNames[props.kind]}: </span>}
      {variant.label}
    </span>
  );
}
