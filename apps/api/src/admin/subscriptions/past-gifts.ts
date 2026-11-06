import { and, type Database, eq, inArray, isNull, schema } from "@billsafi/db";
import { effectiveWindowEnd } from "@billsafi/domain";
import type { AllowanceService } from "../../billing/allowance.service.js";
import type { Mailer } from "../../mail/mailer.js";
import { type PastGifts, pastGiftsEmail } from "../../mail/templates.js";

const { accountGrants, subscriptions, users } = schema;

export interface PastGiftRecipient {
  userId: string;
  email: string;
  name: string;
  gifts: PastGifts;
  /** The gifts this email covers, marked as notified once it is sent. */
  grantIds: string[];
}

/**
 * Accounts with gifts nobody was emailed about that are still in use (D078): Pro months
 * that haven't run out, and credit gifts on accounts that still have credits.
 */
export async function findPastGifts(
  db: Database,
  allowance: Pick<AllowanceService, "credits">,
  now: Date,
): Promise<PastGiftRecipient[]> {
  const rows = await db
    .select({
      grant: accountGrants,
      email: users.email,
      name: users.name,
      paidUntil: subscriptions.paidUntil,
    })
    .from(accountGrants)
    .innerJoin(users, eq(users.id, accountGrants.userId))
    .leftJoin(subscriptions, eq(subscriptions.userId, accountGrants.userId))
    .where(and(isNull(accountGrants.notifiedAt), eq(users.banned, false)))
    .orderBy(accountGrants.userId, accountGrants.createdAt);

  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    byUser.set(row.grant.userId, [...(byUser.get(row.grant.userId) ?? []), row]);
  }

  const recipients: PastGiftRecipient[] = [];
  for (const [userId, grants] of byUser) {
    const first = grants[0]!;
    const pro = grants.filter(
      ({ grant }) =>
        grant.kind === "pro_months" &&
        grant.grantedUntil !== null &&
        effectiveWindowEnd(grant.grantedUntil, grant.endedEarlyAt).end > now,
    );
    const creditGrants = grants.filter(({ grant }) => grant.kind === "invoice_credits");
    const left = creditGrants.length ? await allowance.credits(db, userId) : 0;
    const credits = left > 0 ? creditGrants : [];
    if (!pro.length && !credits.length) continue;

    const gifts: PastGifts = {};
    if (pro.length) {
      const ends = pro.map(
        ({ grant }) => effectiveWindowEnd(grant.grantedUntil!, grant.endedEarlyAt).end,
      );
      const latest = new Date(Math.max(...ends.map((end) => end.getTime())));
      gifts.pro = {
        months: pro.reduce((sum, { grant }) => sum + grant.quantity, 0),
        until: first.paidUntil && first.paidUntil > latest ? first.paidUntil : latest,
      };
    }
    if (credits.length) {
      gifts.credits = { given: credits.reduce((sum, { grant }) => sum + grant.quantity, 0), left };
    }
    recipients.push({
      userId,
      email: first.email,
      name: first.name,
      gifts,
      grantIds: [...pro, ...credits].map(({ grant }) => grant.id),
    });
  }
  return recipients;
}

/** Sends each email and marks its gifts as notified, so a second run sends nothing. */
export async function sendPastGifts(
  db: Database,
  mailer: Mailer,
  billingUrl: string,
  recipients: PastGiftRecipient[],
): Promise<{ sent: number; failed: string[] }> {
  let sent = 0;
  const failed: string[] = [];
  for (const recipient of recipients) {
    try {
      await mailer.send(
        pastGiftsEmail(recipient.email, recipient.name, recipient.gifts, billingUrl),
        {
          operation: "past_gifts_email",
          accountId: recipient.userId,
        },
      );
      await db
        .update(accountGrants)
        .set({ notifiedAt: new Date() })
        .where(inArray(accountGrants.id, recipient.grantIds));
      sent++;
    } catch {
      failed.push(recipient.userId);
    }
  }
  return { sent, failed };
}
