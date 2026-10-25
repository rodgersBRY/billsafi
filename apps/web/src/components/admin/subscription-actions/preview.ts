import { addNairobiMonths, proPeriodAt } from "@billsafi/domain";

/*
 * Previews of what an action will do, using the same rules as the API (BillingService
 * extendPro and AdminSubscriptionActionsService endPro), so the dialog can say the result
 * before the admin confirms. The API's answer is still what counts.
 */

export interface ProState {
  anchorAt: string | null;
  paidMonths: number;
}

/** Pro end after adding `months`: from the current end while active, else from now. */
export function proUntilAfter(state: ProState, months: number, now = new Date()): Date {
  const anchor = state.anchorAt ? new Date(state.anchorAt) : null;
  const until = anchor ? addNairobiMonths(anchor, state.paidMonths) : null;
  const active = until !== null && now < until;
  return active
    ? addNairobiMonths(anchor!, state.paidMonths + months)
    : addNairobiMonths(now, months);
}

export type EndProPreview =
  { allowed: true; endsOn: Date; droppedMonths: number } | { allowed: false; reason: string };

/** Where End Pro would stop the run: the end of the current Pro month. */
export function endProPreview(state: ProState, now = new Date()): EndProPreview {
  const anchor = state.anchorAt ? new Date(state.anchorAt) : null;
  const period = anchor ? proPeriodAt(anchor, state.paidMonths, now) : null;
  if (!period) return { allowed: false, reason: "This account isn't on Pro." };
  const droppedMonths = state.paidMonths - (period.index + 1);
  if (droppedMonths === 0) {
    return { allowed: false, reason: "Pro already ends at the end of the current Pro month." };
  }
  return { allowed: true, endsOn: period.end, droppedMonths };
}

/** Today's Nairobi date, YYYY-MM-DD. */
export function nairobiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now);
}

/** The start of a Nairobi calendar day as an ISO instant with its offset. */
export function nairobiDayStartIso(day: string): string {
  return `${day}T00:00:00+03:00`;
}

/** A Nairobi day `days` after today, YYYY-MM-DD. */
export function nairobiDayAfter(days: number, now = new Date()): string {
  return nairobiToday(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
}
