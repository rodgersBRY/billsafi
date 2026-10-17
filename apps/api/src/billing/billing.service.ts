import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { BillingOverview, Checkout, SubscriptionPayment } from "@tallynest/contracts";
import { and, type DatabaseConnection, desc, eq, schema, sql } from "@tallynest/db";
import {
  addNairobiMonths,
  CREDIT_PACK,
  nairobiDate,
  PRO_PLAN,
  REMINDER_DAYS_BEFORE,
} from "@tallynest/domain";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";
import { MAILER } from "../mail/mail.module.js";
import type { Mailer } from "../mail/mailer.js";
import { renewalReminderEmail } from "../mail/templates.js";
import { AllowanceService, type SubscriptionRow, type Transaction } from "./allowance.service.js";
import { MPESA_PROVIDER, type MpesaProvider } from "./mpesa/mpesa.provider.js";

const { subscriptions, subscriptionPayments, subscriptionEvents, subscriptionReminders, users } =
  schema;

type PaymentRow = typeof subscriptionPayments.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A new checkout waits this long for an earlier prompt to be answered. */
const PENDING_WINDOW_MS = 2 * 60 * 1000;
/** Ask Daraja directly once a callback is this late. */
const QUERY_AFTER_MS = 20 * 1000;
/** Give up on a request Daraja still cannot report on after a day. */
const ABANDON_AFTER_MS = DAY_MS;

/** What a callback or status query says happened to an STK request. */
export type PaymentOutcome =
  | { state: "succeeded"; receipt?: string; amount?: number }
  | { state: "failed"; resultCode: string; resultDescription: string };

export function paidThrough(subscription: SubscriptionRow): Date | null {
  return subscription.anchorAt
    ? addNairobiMonths(subscription.anchorAt, subscription.paidMonths)
    : null;
}

function toPayment(row: PaymentRow): SubscriptionPayment {
  return {
    id: row.id,
    purpose: row.purpose,
    amount: row.amount,
    phone: row.phone,
    status: row.status,
    receipt: row.receipt,
    resultDescription: row.status === "failed" ? row.resultDescription : null,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    grantedUntil: row.grantedUntil?.toISOString() ?? null,
    creditsGranted: row.creditsGranted,
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
  ) {}

  private get db() {
    return this.connection.db;
  }

  async overview(userId: string, at = new Date()): Promise<BillingOverview> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    const recent = await this.db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.userId, userId))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(20);
    const until = subscription ? paidThrough(subscription) : null;
    const active = until !== null && at < until;
    const cancelled = active && subscription!.cancelledAt !== null;
    const pending = recent.find((payment) => payment.status === "pending");
    return {
      usage: await this.allowance.usageFor(this.db, userId, subscription ?? null, at),
      subscription: {
        status: active ? (cancelled ? "cancelled" : "active") : "free",
        paidUntil: until?.toISOString() ?? null,
        cancelledAt: cancelled ? subscription!.cancelledAt!.toISOString() : null,
        renewalDue:
          active && !cancelled && until.getTime() - at.getTime() <= REMINDER_DAYS_BEFORE * DAY_MS,
      },
      pendingPayment: pending ? toPayment(pending) : null,
      payments: recent.filter((payment) => payment.status !== "pending").map(toPayment),
    };
  }

  /** Sends an STK Push for one Pro month or one credit pack. */
  async checkout(userId: string, input: Checkout): Promise<SubscriptionPayment> {
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

    const amount = input.purpose === "pro_month" ? PRO_PLAN.price : CREDIT_PACK.price;
    const [payment] = await this.db
      .insert(subscriptionPayments)
      .values({
        userId,
        purpose: input.purpose,
        amount,
        phone: input.phone,
        provider: this.mpesa.name,
      })
      .returning();

    try {
      const accepted = await this.mpesa.stkPush({
        amount: Number(amount),
        phone: input.phone.replace(/^\+/, ""),
        accountReference: "TallyNest",
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
        await tx.insert(subscriptionEvents).values({
          subscriptionId: subscription.id,
          kind: "credits_added",
          paymentId: payment.id,
          details: { credits: CREDIT_PACK.invoices },
        });
        return;
      }

      // Each Pro payment buys one month: from the current expiry while active,
      // or from now as a new anniversary anchor after expiry (D044, D051).
      const until = paidThrough(subscription);
      const active = until !== null && now < until;
      const anchorAt = active ? subscription.anchorAt! : now;
      const paidMonths = active ? subscription.paidMonths + 1 : 1;
      const grantedFrom = active ? until : now;
      const grantedUntil = addNairobiMonths(anchorAt, paidMonths);
      await tx
        .update(subscriptions)
        .set({ anchorAt, paidMonths, cancelledAt: null })
        .where(eq(subscriptions.id, subscription.id));
      await tx
        .update(subscriptionPayments)
        .set({
          status: "succeeded",
          receipt: outcome.receipt ?? null,
          resultCode: "0",
          confirmedAt: now,
          grantedFrom,
          grantedUntil,
        })
        .where(eq(subscriptionPayments.id, payment.id));
      await tx.insert(subscriptionEvents).values({
        subscriptionId: subscription.id,
        kind: active ? "renewed" : "activated",
        paymentId: payment.id,
        details: {
          grantedFrom: grantedFrom.toISOString(),
          grantedUntil: grantedUntil.toISOString(),
        },
      });
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
