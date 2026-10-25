import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  BillingGrant,
  BillingOverview,
  Checkout,
  PlanPrices,
  SubscriptionPayment,
} from "@billsafi/contracts";
import { and, type DatabaseConnection, desc, eq, schema, sql } from "@billsafi/db";
import {
  addNairobiMonths,
  CREDIT_PACK,
  effectiveWindowEnd,
  nairobiDate,
  PRO_PLAN,
  REMINDER_DAYS_BEFORE,
  usdToKes,
} from "@billsafi/domain";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";
import { MAILER } from "../mail/mail.module.js";
import type { Mailer } from "../mail/mailer.js";
import { renewalReminderEmail } from "../mail/templates.js";
import { AllowanceService, type SubscriptionRow, type Transaction } from "./allowance.service.js";
import { ExchangeRateService, type UsdKesRate } from "./exchange-rate.service.js";
import { MPESA_PROVIDER, type MpesaProvider } from "./mpesa/mpesa.provider.js";

const {
  subscriptions,
  subscriptionPayments,
  subscriptionEvents,
  subscriptionReminders,
  users,
  accountGrants,
  adminIdempotencyKeys,
} = schema;

type PaymentRow = typeof subscriptionPayments.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A new checkout waits this long for an earlier prompt to be answered. */
const PENDING_WINDOW_MS = 2 * 60 * 1000;
/** Ask Daraja directly once a callback is this late. */
const QUERY_AFTER_MS = 20 * 1000;
/** Billing history entries (payments and grants together) on the Billing page. */
const HISTORY_LENGTH = 20;
/** Admin Idempotency-Key rows are kept this long. */
const IDEMPOTENCY_KEY_DAYS = 30;
/** Give up on a request Daraja still cannot report on after a day. */
const ABANDON_AFTER_MS = DAY_MS;

/** What a callback or status query says happened to an STK request. */
export type PaymentOutcome =
  | { state: "succeeded"; receipt?: string; amount?: number }
  | { state: "failed"; resultCode: string; resultDescription: string };

const PRICES_USD = {
  pro_month: PRO_PLAN.priceUsd,
  invoice_credits: CREDIT_PACK.priceUsd,
} as const;

function planPrices(rate: UsdKesRate | null): PlanPrices {
  return {
    usd: PRICES_USD,
    kes: rate
      ? {
          pro_month: usdToKes(PRICES_USD.pro_month, rate.rate),
          invoice_credits: usdToKes(PRICES_USD.invoice_credits, rate.rate),
        }
      : null,
    usdKesRate: rate?.rate ?? null,
    rateUpdatedAt: rate?.updatedAt?.toISOString() ?? null,
  };
}

/** A Pro extension applied by BillingService.extendPro. */
export interface ProExtension {
  /** activated: a new run from now; renewed: added to the active run. */
  kind: "activated" | "renewed";
  grantedFrom: Date;
  grantedUntil: Date;
  /** The subscription row after the change. */
  subscription: SubscriptionRow;
}

export function paidThrough(subscription: SubscriptionRow): Date | null {
  return subscription.anchorAt
    ? addNairobiMonths(subscription.anchorAt, subscription.paidMonths)
    : null;
}

/**
 * A plan payment as the account sees it. A manual payment shows its method and the payer's
 * reference as the receipt; who recorded it and the admin's note stay out.
 */
function toPayment(row: PaymentRow): SubscriptionPayment {
  const manual = row.provider === schema.MANUAL_PROVIDER;
  const window = row.grantedUntil ? effectiveWindowEnd(row.grantedUntil, row.endedEarlyAt) : null;
  return {
    id: row.id,
    purpose: row.purpose,
    source: manual ? "manual" : "mpesa",
    method: row.method,
    quantity: row.quantity,
    amount: row.amount,
    currency: row.currency as SubscriptionPayment["currency"],
    phone: row.phone,
    status: row.status,
    receipt: manual ? row.externalReference : row.receipt,
    resultDescription: row.status === "failed" ? row.resultDescription : null,
    createdAt: row.createdAt.toISOString(),
    // A manual payment is dated by the day it was paid.
    confirmedAt: (manual ? row.paidAt : row.confirmedAt)?.toISOString() ?? null,
    grantedUntil: window?.end.toISOString() ?? null,
    endedEarly: window?.endedEarly ?? false,
    creditsGranted: row.creditsGranted,
  };
}

/** A complimentary grant as the account sees it: no admin, no internal reason. */
function toGrant(row: typeof schema.accountGrants.$inferSelect): BillingGrant {
  const window = row.grantedUntil ? effectiveWindowEnd(row.grantedUntil, row.endedEarlyAt) : null;
  return {
    id: row.id,
    kind: row.kind,
    quantity: row.quantity,
    createdAt: row.createdAt.toISOString(),
    grantedUntil: window?.end.toISOString() ?? null,
    endedEarly: window?.endedEarly ?? false,
  };
}

/**
 * Pro subscriptions and invoice credits paid through the platform Paybill
 * with M-Pesa STK Push (D020, D044, D051).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    @Inject(MPESA_PROVIDER) private readonly mpesa: MpesaProvider,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
    private readonly allowance: AllowanceService,
    private readonly rates: ExchangeRateService,
  ) {}

  private get db() {
    return this.connection.db;
  }

  async overview(userId: string, at = new Date()): Promise<BillingOverview> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    const [pending] = await this.db
      .select()
      .from(subscriptionPayments)
      .where(
        and(eq(subscriptionPayments.userId, userId), eq(subscriptionPayments.status, "pending")),
      )
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(1);
    const history = await this.history(userId);
    const until = subscription ? paidThrough(subscription) : null;
    const active = until !== null && at < until;
    const cancelled = active && subscription!.cancelledAt !== null;
    return {
      usage: await this.allowance.usageFor(this.db, userId, subscription ?? null, at),
      prices: planPrices(await this.rates.usdKes()),
      subscription: {
        status: active ? (cancelled ? "cancelled" : "active") : "free",
        paidUntil: until?.toISOString() ?? null,
        cancelledAt: cancelled ? subscription!.cancelledAt!.toISOString() : null,
        renewalDue:
          active && !cancelled && until.getTime() - at.getTime() <= REMINDER_DAYS_BEFORE * DAY_MS,
      },
      pendingPayment: pending ? toPayment(pending) : null,
      ...history,
    };
  }

  /**
   * The latest 20 entries of the account's billing history: settled payments and grants
   * together, newest first by the date the page shows (toPayment's confirmedAt, else the
   * creation time). The top 20 of each list is enough to find the top 20 of both.
   */
  private async history(userId: string) {
    const shownAt = sql`coalesce(case when ${subscriptionPayments.provider} = ${schema.MANUAL_PROVIDER}
      then ${subscriptionPayments.paidAt} else ${subscriptionPayments.confirmedAt} end,
      ${subscriptionPayments.createdAt})`;
    const payments = (
      await this.db
        .select()
        .from(subscriptionPayments)
        .where(
          and(
            eq(subscriptionPayments.userId, userId),
            sql`${subscriptionPayments.status} <> 'pending'`,
          ),
        )
        .orderBy(desc(shownAt), desc(subscriptionPayments.id))
        .limit(HISTORY_LENGTH)
    ).map(toPayment);
    const grants = (
      await this.db
        .select()
        .from(accountGrants)
        .where(eq(accountGrants.userId, userId))
        .orderBy(desc(accountGrants.createdAt), desc(accountGrants.id))
        .limit(HISTORY_LENGTH)
    ).map(toGrant);
    const timeline = [
      ...payments.map((payment) => ({ at: payment.confirmedAt ?? payment.createdAt, payment })),
      ...grants.map((grant) => ({ at: grant.createdAt, grant })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, HISTORY_LENGTH);
    return {
      payments: timeline.flatMap((entry) => ("payment" in entry ? [entry.payment] : [])),
      grants: timeline.flatMap((entry) => ("grant" in entry ? [entry.grant] : [])),
    };
  }

  /** Sends an STK Push for one Pro month or one credit pack. */
  async checkout(userId: string, input: Checkout): Promise<SubscriptionPayment> {
    if (this.mpesa.name === "disabled") {
      throw new ServiceUnavailableException({
        code: "BILLING_UNAVAILABLE",
        message: "M-Pesa payments aren't available yet. Please try again later.",
      });
    }
    const [latestPending] = await this.db
      .select()
      .from(subscriptionPayments)
      .where(
        and(eq(subscriptionPayments.userId, userId), eq(subscriptionPayments.status, "pending")),
      )
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(1);
    if (latestPending) {
      const refreshed = await this.refresh(latestPending);
      if (
        refreshed.status === "pending" &&
        Date.now() - refreshed.createdAt.getTime() < PENDING_WINDOW_MS
      ) {
        throw new ConflictException({
          code: "PAYMENT_PENDING",
          message:
            "A payment request is already waiting on your phone. Approve or cancel it first.",
          payment: toPayment(refreshed),
        });
      }
    }

    const rate = await this.rates.usdKes();
    if (!rate) {
      throw new ServiceUnavailableException({
        code: "RATE_UNAVAILABLE",
        message: "We couldn't get today's exchange rate. Please try again in a few minutes.",
      });
    }
    const priceUsd = PRICES_USD[input.purpose];
    const amount = usdToKes(priceUsd, rate.rate);
    const [payment] = await this.db
      .insert(subscriptionPayments)
      .values({
        userId,
        purpose: input.purpose,
        amount,
        priceUsd,
        usdKesRate: rate.rate,
        phone: input.phone,
        provider: this.mpesa.name,
        // Pending-age checks compare against this process's clock, so stamp it here.
        createdAt: new Date(),
      })
      .returning();

    try {
      const accepted = await this.mpesa.stkPush({
        amount: Number(amount),
        phone: input.phone.replace(/^\+/, ""),
        accountReference: "BillSafi",
        description: input.purpose === "pro_month" ? "Pro month" : "Credits",
      });
      const [updated] = await this.db
        .update(subscriptionPayments)
        .set({
          merchantRequestId: accepted.merchantRequestId,
          checkoutRequestId: accepted.checkoutRequestId,
        })
        .where(eq(subscriptionPayments.id, payment!.id))
        .returning();
      return toPayment(updated!);
    } catch (error) {
      const message = error instanceof Error ? error.message : "M-Pesa is unavailable";
      this.logger.warn(`STK Push failed for payment ${payment!.id}: ${message}`);
      await this.db
        .update(subscriptionPayments)
        .set({ status: "failed", resultCode: "REQUEST_FAILED", resultDescription: message })
        .where(eq(subscriptionPayments.id, payment!.id));
      throw new BadGatewayException({
        code: "MPESA_UNAVAILABLE",
        message: "We couldn't send the M-Pesa request. Check the number and try again.",
      });
    }
  }

  /** The payment's current state; asks Daraja when the callback is late. */
  async payment(userId: string, paymentId: string): Promise<SubscriptionPayment> {
    const [row] = await this.db
      .select()
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.id, paymentId), eq(subscriptionPayments.userId, userId)));
    if (!row) throw new NotFoundException("Payment not found");
    return toPayment(await this.refresh(row));
  }

  /** Applies a Daraja callback. Unknown requests are ignored. */
  async confirm(checkoutRequestId: string, outcome: PaymentOutcome): Promise<void> {
    const [row] = await this.db
      .select({ userId: subscriptionPayments.userId })
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.checkoutRequestId, checkoutRequestId));
    if (!row) {
      this.logger.warn(`Callback for unknown checkout request ${checkoutRequestId}`);
      return;
    }
    await this.settle(row.userId, checkoutRequestId, outcome);
  }

  async cancel(userId: string, at = new Date()): Promise<BillingOverview> {
    await this.db.transaction(async (tx) => {
      const subscription = await this.allowance.lockAccount(tx, userId);
      const until = paidThrough(subscription);
      if (!until || at >= until) {
        throw new ConflictException({ code: "NOT_SUBSCRIBED", message: "You're not on Pro." });
      }
      if (subscription.cancelledAt) return;
      await tx
        .update(subscriptions)
        .set({ cancelledAt: at })
        .where(eq(subscriptions.id, subscription.id));
      await tx.insert(subscriptionEvents).values({
        subscriptionId: subscription.id,
        kind: "cancelled",
        details: { accessUntil: until.toISOString() },
      });
    });
    return this.overview(userId, at);
  }

  /** Undoing a cancellation before expiry costs nothing and changes no dates (D044). */
  async resume(userId: string, at = new Date()): Promise<BillingOverview> {
    await this.db.transaction(async (tx) => {
      const subscription = await this.allowance.lockAccount(tx, userId);
      const until = paidThrough(subscription);
      if (!until || at >= until) {
        throw new ConflictException({
          code: "NOT_SUBSCRIBED",
          message: "Pro has already ended. Pay for a new month to restart it.",
        });
      }
      if (!subscription.cancelledAt) return;
      await tx
        .update(subscriptions)
        .set({ cancelledAt: null })
        .where(eq(subscriptions.id, subscription.id));
      await tx.insert(subscriptionEvents).values({
        subscriptionId: subscription.id,
        kind: "cancellation_undone",
      });
    });
    return this.overview(userId, at);
  }

  /** Settles late pending payments; run on a timer so a lost callback cannot strand one. */
  async sweepPending(at = new Date()): Promise<void> {
    const stale = await this.db
      .select()
      .from(subscriptionPayments)
      .where(
        and(
          eq(subscriptionPayments.status, "pending"),
          sql`${subscriptionPayments.createdAt} < ${new Date(at.getTime() - QUERY_AFTER_MS).toISOString()}`,
        ),
      )
      .limit(50);
    for (const payment of stale) await this.refresh(payment, at);
  }

  /**
   * Deletes admin Idempotency-Key rows older than 30 days: a retry never comes that late,
   * and the payment or grant they point to is kept. Runs with the billing jobs.
   */
  async pruneIdempotencyKeys(at = new Date()): Promise<number> {
    const cutoff = new Date(at.getTime() - IDEMPOTENCY_KEY_DAYS * DAY_MS);
    const deleted = await this.db
      .delete(adminIdempotencyKeys)
      .where(sql`${adminIdempotencyKeys.createdAt} < ${cutoff.toISOString()}`)
      .returning({ key: adminIdempotencyKeys.key });
    return deleted.length;
  }

  /** Sends each renewal reminder once per expiry date (D051). */
  async sendReminders(at = new Date()): Promise<number> {
    const candidates = await this.db
      .select({ subscription: subscriptions, email: users.email, name: users.name })
      .from(subscriptions)
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .where(
        and(sql`${subscriptions.anchorAt} is not null`, sql`${subscriptions.cancelledAt} is null`),
      );
    let sent = 0;
    for (const { subscription, email, name } of candidates) {
      const until = paidThrough(subscription)!;
      const kind =
        nairobiDate(at) === nairobiDate(until) && at < until
          ? "on_expiry"
          : at < until && until.getTime() - at.getTime() <= REMINDER_DAYS_BEFORE * DAY_MS
            ? "before_expiry"
            : null;
      if (!kind) continue;
      const [claimed] = await this.db
        .insert(subscriptionReminders)
        .values({ subscriptionId: subscription.id, kind, expiresAt: until })
        .onConflictDoNothing()
        .returning({ id: subscriptionReminders.id });
      if (!claimed) continue;
      try {
        await this.mailer.send(
          renewalReminderEmail(email, name, until, `${this.env.WEB_ORIGIN}/billing`, kind),
        );
        sent++;
      } catch (error) {
        // Release the claim so the next run tries again.
        await this.db.delete(subscriptionReminders).where(eq(subscriptionReminders.id, claimed.id));
        this.logger.warn(`Reminder to ${email} failed: ${String(error)}`);
      }
    }
    return sent;
  }

  private async refresh(payment: PaymentRow, at = new Date()): Promise<PaymentRow> {
    if (payment.status !== "pending" || !payment.checkoutRequestId) return payment;
    const age = at.getTime() - payment.createdAt.getTime();
    if (age < QUERY_AFTER_MS) return payment;
    try {
      const result = await this.mpesa.query(payment.checkoutRequestId);
      if (result.state !== "pending") {
        await this.settle(payment.userId, payment.checkoutRequestId, result);
      } else if (age > ABANDON_AFTER_MS) {
        await this.settle(payment.userId, payment.checkoutRequestId, {
          state: "failed",
          resultCode: "EXPIRED",
          resultDescription: "The payment request expired",
        });
      }
    } catch (error) {
      this.logger.warn(`Status query for ${payment.checkoutRequestId} failed: ${String(error)}`);
    }
    const [current] = await this.db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.id, payment.id));
    return current!;
  }

  /**
   * Moves a pending payment to its final state once, under the account lock.
   * Repeated callbacks, a callback racing a status query, and a reused receipt
   * cannot grant access twice (D020, D051).
   */
  private async settle(userId: string, checkoutRequestId: string, outcome: PaymentOutcome) {
    await this.db.transaction(async (tx) => {
      const subscription = await this.allowance.lockAccount(tx, userId);
      const [payment] = await tx
        .select()
        .from(subscriptionPayments)
        .where(eq(subscriptionPayments.checkoutRequestId, checkoutRequestId))
        .for("update");
      if (!payment) return;

      if (payment.status !== "pending") {
        // A status query may confirm before the callback brings the receipt.
        if (payment.status === "succeeded" && !payment.receipt && outcome.state === "succeeded") {
          if (outcome.receipt && !(await this.receiptUsed(tx, outcome.receipt))) {
            await tx
              .update(subscriptionPayments)
              .set({ receipt: outcome.receipt })
              .where(eq(subscriptionPayments.id, payment.id));
          }
        }
        return;
      }

      if (outcome.state === "failed") {
        await this.fail(tx, payment.id, outcome.resultCode, outcome.resultDescription);
        return;
      }
      if (outcome.receipt && (await this.receiptUsed(tx, outcome.receipt))) {
        await this.fail(
          tx,
          payment.id,
          "RECEIPT_REUSED",
          "This M-Pesa transaction was already used",
        );
        this.logger.warn(`Receipt ${outcome.receipt} reused for payment ${payment.id}`);
        return;
      }
      if (outcome.amount !== undefined && outcome.amount !== Number(payment.amount)) {
        await this.fail(
          tx,
          payment.id,
          "AMOUNT_MISMATCH",
          `Paid KES ${outcome.amount}, expected KES ${Number(payment.amount)}`,
        );
        this.logger.error(`Amount mismatch on payment ${payment.id}; needs a manual check`);
        return;
      }

      const now = new Date();
      if (payment.purpose === "invoice_credits") {
        await tx
          .update(subscriptionPayments)
          .set({
            status: "succeeded",
            receipt: outcome.receipt ?? null,
            resultCode: "0",
            confirmedAt: now,
            creditsGranted: CREDIT_PACK.invoices,
          })
          .where(eq(subscriptionPayments.id, payment.id));
        await this.recordCreditsAdded(tx, subscription.id, CREDIT_PACK.invoices, {
          paymentId: payment.id,
        });
        return;
      }

      // Each Pro payment buys one month (D044, D051).
      const extension = await this.extendPro(tx, subscription, 1, now);
      await tx
        .update(subscriptionPayments)
        .set({
          status: "succeeded",
          receipt: outcome.receipt ?? null,
          resultCode: "0",
          confirmedAt: now,
          grantedFrom: extension.grantedFrom,
          grantedUntil: extension.grantedUntil,
        })
        .where(eq(subscriptionPayments.id, payment.id));
      await this.recordProEvent(tx, subscription.id, extension, { paymentId: payment.id });
    });
  }

  /**
   * Adds `months` Pro months under the account lock (taken by the caller): from the current
   * expiry while Pro is active, or from `now` as a new anniversary anchor after it ended
   * (D044, D051). M-Pesa payments, manual payments and admin grants all go through here, so
   * the rule is the same whichever way Pro is added. Also writes `paidUntil`.
   *
   * A payment clears an earlier cancellation (D051). A gift keeps it while Pro is active,
   * since the account said it does not want to continue; a new run always starts uncancelled.
   */
  async extendPro(
    tx: Transaction,
    subscription: SubscriptionRow,
    months: number,
    now: Date,
    { clearCancellation = true }: { clearCancellation?: boolean } = {},
  ): Promise<ProExtension> {
    if (!Number.isInteger(months) || months < 1) throw new Error(`Invalid Pro months: ${months}`);
    const until = paidThrough(subscription);
    const active = until !== null && now < until;
    const anchorAt = active ? subscription.anchorAt! : now;
    const paidMonths = active ? subscription.paidMonths + months : months;
    const grantedFrom = active ? until : now;
    const grantedUntil = addNairobiMonths(anchorAt, paidMonths);
    const [updated] = await tx
      .update(subscriptions)
      .set({
        anchorAt,
        paidMonths,
        paidUntil: grantedUntil,
        cancelledAt: active && !clearCancellation ? subscription.cancelledAt : null,
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();
    return {
      kind: active ? "renewed" : "activated",
      grantedFrom,
      grantedUntil,
      subscription: updated!,
    };
  }

  /** The plan history row for a Pro extension from a payment. */
  async recordProEvent(
    tx: Transaction,
    subscriptionId: string,
    extension: ProExtension,
    { paymentId, details = {} }: { paymentId: string; details?: Record<string, unknown> },
  ): Promise<void> {
    await tx.insert(subscriptionEvents).values({
      subscriptionId,
      kind: extension.kind,
      paymentId,
      details: {
        ...details,
        grantedFrom: extension.grantedFrom.toISOString(),
        grantedUntil: extension.grantedUntil.toISOString(),
      },
    });
  }

  /**
   * The plan history row for credits a payment added. The balance itself is derived from
   * the payment (or grant) rows by AllowanceService.credits, so nothing else changes here.
   */
  async recordCreditsAdded(
    tx: Transaction,
    subscriptionId: string,
    credits: number,
    { paymentId, details = {} }: { paymentId: string; details?: Record<string, unknown> },
  ): Promise<void> {
    await tx.insert(subscriptionEvents).values({
      subscriptionId,
      kind: "credits_added",
      paymentId,
      details: { ...details, credits },
    });
  }

  private async fail(tx: Transaction, paymentId: string, resultCode: string, description: string) {
    await tx
      .update(subscriptionPayments)
      .set({ status: "failed", resultCode, resultDescription: description })
      .where(eq(subscriptionPayments.id, paymentId));
  }

  private async receiptUsed(tx: Transaction, receipt: string) {
    const [existing] = await tx
      .select({ id: subscriptionPayments.id })
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.receipt, receipt));
    return Boolean(existing);
  }
}
