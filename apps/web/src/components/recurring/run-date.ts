const short = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", timeZone: "UTC" });

/** Run date as "1 Dec". */
export function formatRunDate(isoDate: string): string {
  return short.format(new Date(`${isoDate}T00:00:00Z`));
}
