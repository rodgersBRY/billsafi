import type { SubscriptionPurpose } from "@billsafi/contracts";
import { CREDIT_PACK } from "@billsafi/domain";
import { formatMoney } from "@/lib/format";

const NO_DATA = "No data";

const countFormat = new Intl.NumberFormat("en-KE");

export function formatCount(value: number): string {
  return countFormat.format(value);
}

/**
 * A 0-1 fraction as a percentage: whole numbers, one decimal near 0% and 100%.
 * Only exactly 1 shows as 100%, and a tiny non-zero share shows as "<0.1%".
 */
export function formatShare(value: number | null): string {
  if (value === null) return NO_DATA;
  const percent = value * 100;
  const size = Math.abs(percent);
  const sign = percent < 0 ? "-" : "";
  if (size > 0 && size < 0.1) return `${sign}<0.1%`;
  if (size > 99.9 && size < 100) return `${sign}>99.9%`;
  const digits = size > 0 && (size < 10 || (size > 90 && size < 100)) ? 1 : 0;
  return `${percent.toFixed(digits).replace(/\.0$/, "")}%`;
}

export function formatKes(amount: string): string {
  return formatMoney(amount, "KES");
}

export function formatUsd(amount: string | null): string {
  return amount === null ? NO_DATA : formatMoney(amount, "USD");
}

/** Seconds as one rounded unit: "40 s", "12 min", "2 h", "3 d". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return NO_DATA;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} d`;
}

const instantFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

const dayFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

const monthFormat = new Intl.DateTimeFormat("en-KE", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** An ISO instant as a Nairobi date and time. */
export function formatInstant(iso: string): string {
  return instantFormat.format(new Date(iso));
}

/** An ISO instant as its Nairobi calendar date. */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** A YYYY-MM month, like "Oct 2026". */
export function formatMonth(month: string): string {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

export const purposeLabels: Record<SubscriptionPurpose, string> = {
  pro_month: "Pro, one month",
  invoice_credits: `${CREDIT_PACK.invoices} invoice credits`,
};
