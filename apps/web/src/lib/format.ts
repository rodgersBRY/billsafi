const money = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Display only. Amounts stay decimal strings everywhere else. */
export function formatMoney(amount: string | number, currency = "KES"): string {
  return `${currency} ${money.format(Number(amount))}`;
}

export function formatAmount(amount: string | number): string {
  return money.format(Number(amount));
}

const dateFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats a calendar date (YYYY-MM-DD) without shifting it across timezones. */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Today's calendar date in Nairobi, as YYYY-MM-DD. */
export function todayInNairobi(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
