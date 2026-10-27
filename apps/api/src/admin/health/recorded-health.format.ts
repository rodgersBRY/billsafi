const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "3 minutes", "5 hours", "2 days": a rough age for one plain sentence. */
export function ageText(ms: number): string {
  const value = Math.max(0, ms);
  if (value < MINUTE_MS) return "under a minute";
  if (value < HOUR_MS) {
    const minutes = Math.floor(value / MINUTE_MS);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  if (value < 48 * HOUR_MS) {
    const hours = Math.floor(value / HOUR_MS);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${Math.floor(value / (24 * HOUR_MS))} days`;
}

export { HOUR_MS, MINUTE_MS };
