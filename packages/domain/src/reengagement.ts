import type { LifecycleStage } from "./account-status.js";

/*
 * Check-in emails for quiet accounts (D069). An account gets at most three emails per
 * quiet spell. A spell starts at the account's last sign-in or action and ends when it
 * comes back, which also stops the sequence.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReengagementSegment = "no_business" | "no_invoice" | "lapsed";
export type ReengagementStep = 1 | 2 | 3;

/** Days quiet before each step, per segment. */
export const REENGAGEMENT_SCHEDULE: Record<ReengagementSegment, readonly [number, number, number]> =
  {
    no_business: [3, 10, 30],
    no_invoice: [3, 10, 30],
    lapsed: [30, 45, 75],
  };

/** At least this long between two emails in the same spell, so a backlog is spread out. */
export const REENGAGEMENT_MIN_GAP_DAYS = 7;

/** After a finished or interrupted sequence, a new spell waits this long before email 1. */
export const REENGAGEMENT_COOLDOWN_DAYS = 90;

/** Addresses quiet longer than this are left alone: old addresses bounce and hurt delivery. */
export const REENGAGEMENT_MAX_QUIET_DAYS = 365;

export interface SentReengagementEmail {
  step: ReengagementStep;
  sentAt: Date;
}

export interface ReengagementFacts {
  stage: LifecycleStage;
  /** Latest of registration, sign-in, business created and meaningful action. */
  quietSince: Date;
  /** Every check-in email the account has been sent, any spell. */
  sent: readonly SentReengagementEmail[];
}

export interface ReengagementEmail {
  segment: ReengagementSegment;
  step: ReengagementStep;
}

export function reengagementSegment(stage: LifecycleStage): ReengagementSegment | null {
  switch (stage) {
    case "registered":
      return "no_business";
    case "onboarding":
      return "no_invoice";
    case "inactive":
      return "lapsed";
    default:
      // Active and Pro accounts get no check-ins.
      return null;
  }
}

/** The email to send now, or null. Pure, so the job and tests agree on one rule. */
export function nextReengagementEmail(
  facts: ReengagementFacts,
  now: Date,
): ReengagementEmail | null {
  const segment = reengagementSegment(facts.stage);
  if (!segment) return null;

  const quietDays = (now.getTime() - facts.quietSince.getTime()) / DAY_MS;
  if (quietDays > REENGAGEMENT_MAX_QUIET_DAYS) return null;

  const inSpell = facts.sent.filter((email) => email.sentAt > facts.quietSince);
  const earlier = facts.sent.filter((email) => email.sentAt <= facts.quietSince);

  let step: ReengagementStep;
  if (inSpell.length === 0) {
    const lastEarlier = latest(earlier);
    if (
      lastEarlier &&
      now.getTime() - lastEarlier.sentAt.getTime() < REENGAGEMENT_COOLDOWN_DAYS * DAY_MS
    ) {
      return null;
    }
    step = 1;
  } else {
    const last = latest(inSpell)!;
    const highest = Math.max(...inSpell.map((email) => email.step));
    if (highest >= 3) return null;
    if (now.getTime() - last.sentAt.getTime() < REENGAGEMENT_MIN_GAP_DAYS * DAY_MS) return null;
    step = (highest + 1) as ReengagementStep;
  }

  const threshold = REENGAGEMENT_SCHEDULE[segment][step - 1] ?? Infinity;
  return quietDays >= threshold ? { segment, step } : null;
}

function latest(emails: readonly SentReengagementEmail[]): SentReengagementEmail | undefined {
  return emails.reduce<SentReengagementEmail | undefined>(
    (found, email) => (!found || email.sentAt > found.sentAt ? email : found),
    undefined,
  );
}
