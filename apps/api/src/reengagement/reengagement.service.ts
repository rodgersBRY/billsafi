import { Inject, Injectable, Logger } from "@nestjs/common";
import { type DatabaseConnection, inArray, schema, sql } from "@billsafi/db";
import {
  lifecycleStage,
  nextReengagementEmail,
  REENGAGEMENT_MAX_QUIET_DAYS,
  REENGAGEMENT_SCHEDULE,
  type ReengagementStep,
} from "@billsafi/domain";
import { lastMeaningfulActivitySql, proAccessSql } from "../admin/shared/account-sql.js";
import { at, fromUtc, iso, selectRows } from "../admin/shared/admin-sql.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";
import { MAILER } from "../mail/mail.module.js";
import type { Mailer } from "../mail/mailer.js";
import { reengagementEmail } from "./reengagement-templates.js";
import { unsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** No account is quiet enough for any email before this. */
const MIN_QUIET_DAYS = Math.min(...Object.values(REENGAGEMENT_SCHEDULE).map(([first]) => first));
/** Emails go out in Nairobi working hours, when people read them. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 17;

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  businesses: number;
  readyInvoices: number;
  proAccess: boolean;
  lastActivityAt: string | null;
  quietSince: string;
}

export type ReengagementEnv = Pick<
  Env,
  | "WEB_ORIGIN"
  | "BETTER_AUTH_SECRET"
  | "REENGAGEMENT_DAILY_LIMIT"
  | "REENGAGEMENT_REPLY_TO"
  | "REENGAGEMENT_SIGNATURE"
  | "MAIL_FROM"
>;

/** Check-in emails for quiet accounts (D069). */
@Injectable()
export class ReengagementService {
  private readonly logger = new Logger(ReengagementService.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: ReengagementEnv,
  ) {}

  private get db() {
    return this.connection.db;
  }

  /**
   * Sends the emails that are due, up to the daily limit. Each email is claimed in the
   * database first, so two runs never send the same step twice.
   */
  async sendDue(
    now = new Date(),
    /** Limits the run to these accounts. Tests use it to stay clear of other specs' data. */
    onlyUserIds?: string[],
  ): Promise<{ sent: number; skipped?: string }> {
    const hour = nairobiHour(now);
    if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) {
      return { sent: 0, skipped: "outside sending hours" };
    }
    const [recent] = await selectRows<{ count: number }>(
      this.db,
      sql`select count(*)::int as count from reengagement_emails
        where sent_at > ${at(new Date(now.getTime() - DAY_MS))}`,
    );
    let budget = this.env.REENGAGEMENT_DAILY_LIMIT - (recent?.count ?? 0);
    if (budget <= 0) return { sent: 0, skipped: "daily limit reached" };

    const candidates = await this.candidates(now, onlyUserIds);
    const history = await this.history(candidates.map((candidate) => candidate.id));
    let sent = 0;
    for (const candidate of candidates) {
      if (budget <= 0) break;
      const quietSince = new Date(candidate.quietSince);
      const next = nextReengagementEmail(
        {
          stage: lifecycleStage(
            {
              businesses: candidate.businesses,
              readyInvoices: candidate.readyInvoices,
              proAccess: candidate.proAccess,
              lastMeaningfulActivityAt: candidate.lastActivityAt
                ? new Date(candidate.lastActivityAt)
                : null,
            },
            now,
          ),
          quietSince,
          sent: history.get(candidate.id) ?? [],
        },
        now,
      );
      if (!next) continue;

      const [claimed] = await this.db
        .insert(schema.reengagementEmails)
        .values({
          userId: candidate.id,
          segment: next.segment,
          step: next.step,
          quietSince,
          sentAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: schema.reengagementEmails.id });
      if (!claimed) continue;
      budget--;

      const token = unsubscribeToken(this.env.BETTER_AUTH_SECRET, candidate.id);
      const campaign = `${next.segment}_${next.step}`;
      try {
        await this.mailer.send(
          reengagementEmail({
            to: candidate.email,
            name: candidate.name,
            segment: next.segment,
            step: next.step,
            url: `${this.env.WEB_ORIGIN}/?utm_source=email&utm_medium=checkin&utm_campaign=${campaign}`,
            unsubscribeUrl: `${this.env.WEB_ORIGIN}/unsubscribe?token=${encodeURIComponent(token)}`,
            oneClickUrl: `${this.env.WEB_ORIGIN}/api/v1/email-preferences/unsubscribe?token=${encodeURIComponent(token)}`,
            replyTo: this.env.REENGAGEMENT_REPLY_TO ?? this.env.MAIL_FROM,
            signature: this.env.REENGAGEMENT_SIGNATURE,
          }),
          { operation: "reengagement_email", accountId: candidate.id },
        );
        sent++;
      } catch (error) {
        // Release the claim so a later run tries again.
        await this.db
          .delete(schema.reengagementEmails)
          .where(sql`${schema.reengagementEmails.id} = ${claimed.id}`);
        this.logger.warn(`Check-in email ${campaign} failed: ${String(error)}`);
      }
    }
    return { sent };
  }

  /** Records the opt-out. Unknown or forged tokens get the same answer, so they reveal nothing. */
  async unsubscribe(token: string): Promise<void> {
    const userId = verifyUnsubscribeToken(this.env.BETTER_AUTH_SECRET, token);
    if (!userId) return;
    await this.db.execute(sql`
      insert into email_opt_outs (user_id)
      select id from users where id = ${userId}::uuid
      on conflict do nothing
    `);
  }

  /**
   * Accounts that could be due an email: not suspended, not opted out, and quiet for at
   * least the shortest wait and at most a year. The domain rule makes the final call.
   * Newest spells first, so recent sign-ups are reached while they still remember us.
   */
  private candidates(now: Date, onlyUserIds?: string[]): Promise<CandidateRow[]> {
    const quietSince = sql`greatest(
      ${fromUtc(sql`u.created_at`)},
      (select max(greatest(${fromUtc(sql`s.created_at`)}, ${fromUtc(sql`s.updated_at`)}))
        from sessions s where s.user_id = u.id),
      (select max(b.created_at) from businesses b where b.owner_user_id = u.id),
      ${lastMeaningfulActivitySql(sql`u.id`)}
    )`;
    return selectRows<CandidateRow>(
      this.db,
      sql`
        with facts as (
          select u.id, u.name, u.email,
            (select count(*) from businesses b where b.owner_user_id = u.id)::int as businesses,
            (select count(*) from invoice_issuances ii where ii.user_id = u.id)::int as ready_invoices,
            ${proAccessSql(sql`sub.anchor_at`, sql`sub.paid_until`, now)} as pro_access,
            ${lastMeaningfulActivitySql(sql`u.id`)} as last_activity_at,
            ${quietSince} as quiet_since
          from users u
          left join subscriptions sub on sub.user_id = u.id
          where not u.banned
            and not exists (select 1 from email_opt_outs o where o.user_id = u.id)
            ${onlyUserIds ? sql`and u.id = any(${`{${onlyUserIds.join(",")}}`}::uuid[])` : sql``}
        )
        select id, name, email, businesses, ready_invoices as "readyInvoices",
          coalesce(pro_access, false) as "proAccess",
          ${iso(sql`last_activity_at`)} as "lastActivityAt",
          ${iso(sql`quiet_since`)} as "quietSince"
        from facts
        where quiet_since <= ${at(new Date(now.getTime() - MIN_QUIET_DAYS * DAY_MS))}
          and quiet_since > ${at(new Date(now.getTime() - REENGAGEMENT_MAX_QUIET_DAYS * DAY_MS))}
        order by quiet_since desc
      `,
    );
  }

  private async history(userIds: string[]) {
    const byUser = new Map<string, { step: ReengagementStep; sentAt: Date }[]>();
    if (userIds.length === 0) return byUser;
    const rows = await this.db
      .select({
        userId: schema.reengagementEmails.userId,
        step: schema.reengagementEmails.step,
        sentAt: schema.reengagementEmails.sentAt,
      })
      .from(schema.reengagementEmails)
      .where(inArray(schema.reengagementEmails.userId, userIds));
    for (const row of rows) {
      const list = byUser.get(row.userId) ?? [];
      list.push({ step: row.step as ReengagementStep, sentAt: row.sentAt });
      byUser.set(row.userId, list);
    }
    return byUser;
  }
}

/** Nairobi has no daylight saving, so it is always UTC+3. */
function nairobiHour(now: Date): number {
  return (now.getUTCHours() + 3) % 24;
}
