import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import type {
  AdminPaymentRecorded,
  AdminRecordPayment,
  AdminSubscriptionState,
} from "@billsafi/contracts";
import { and, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { CREDIT_PACK, nairobiDate, subscriptionStatus } from "@billsafi/domain";
import { AllowanceService, type SubscriptionRow } from "../billing/allowance.service.js";
import { BillingService, type ProExtension } from "../billing/billing.service.js";
import { DATABASE } from "../database/database.module.js";
import type { Transaction } from "../database/transaction.js";
import {
  type ActionOutcome,
  type ActionTarget,
  type AdminActionContext,
  AdminActionsService,
  conflict,
} from "./admin-actions.service.js";
import { planAt } from "./admin-sql.js";

const { subscriptionPayments, adminIdempotencyKeys } = schema;

const MANUAL = schema.MANUAL_PROVIDER;

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

/** Another request with the same key committed while this one waited; it is replayed. */
class IdempotencyKeyTaken extends ConflictException {
  constructor() {
    super({
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "A request with this Idempotency-Key is still being handled. Try again.",
    });
  }
}

/** A 400 in the same shape as ZodValidationPipe, for checks that need the database. */
function invalid(path: string, message: string): BadRequestException {
  return new BadRequestException({ message: "Validation failed", issues: [{ path, message }] });
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint?: string };
  return pg?.code === UNIQUE_VIOLATION && pg.constraint === constraint;
}

/** The Nairobi day YYYY-MM-DD as the instant it starts. */
function nairobiDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+03:00`);
}

const iso = (value: Date | null) => value?.toISOString() ?? null;

/** Before and after, for the audit row; equal values are kept so the row reads on its own. */
const diff = <T>(from: T, to: T) => ({ from, to });

/** An optional Idempotency-Key for one action on one target. */
interface Idempotency {
  key: string;
  action: string;
  hash: string;
}

/** What an idempotent action calls inside its transaction; both do nothing without a key. */
interface KeySteps<T> {
  /** First step: takes the key, or waits for and replays a request racing with it. */
  claim: (tx: Transaction) => Promise<void>;
  /** Last step: stores the response for replays, committed with the change. */
  save: (tx: Transaction, result: T) => Promise<void>;
}

/**
 * Admin actions on an account's plan (super admin phase 3): manual payments, gifts,
 * ending Pro and limit overrides. Each runs through AdminActionsService.performWith, so it
 * is audited the same way as the phase 1 actions, and takes the user row lock and then the
 * account's subscription lock (AllowanceService.lockAccount) before changing anything.
 * Pro months always go through BillingService.extendPro.
 */
@Injectable()
export class AdminSubscriptionActionsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly actions: AdminActionsService,
    private readonly billing: BillingService,
    private readonly allowance: AllowanceService,
  ) {}

  async recordPayment(
    context: AdminActionContext,
    id: string,
    body: AdminRecordPayment,
    idempotencyKey?: string,
  ): Promise<AdminPaymentRecorded> {
    const target: ActionTarget = {
      action: "tenant.record_payment",
      target: { type: "account", id },
    };
    return this.idempotent(context, target, body, idempotencyKey, (key) =>
      this.actions.performWith(context, target, async (tx) => {
        await key.claim(tx);
        const user = await this.actions.lockUser(tx, id);
        this.refuseSelf(context, id);
        if (body.paidAt < nairobiDate(user.createdAt)) {
          throw invalid("paidAt", "The payment date can't be before the account was created");
        }
        const subscription = await this.allowance.lockAccount(tx, id);
        const now = new Date();
        const before = await this.state(tx, subscription, now);

        const [duplicate] = await tx
          .select({ id: subscriptionPayments.id })
          .from(subscriptionPayments)
          .where(
            and(
              eq(subscriptionPayments.provider, MANUAL),
              eq(subscriptionPayments.method, body.method),
              sql`upper(${subscriptionPayments.externalReference}) = upper(${body.reference})`,
            ),
          );
        if (duplicate) throw this.duplicateReference();

        const pro = body.purpose === "pro_month";
        const quantity = pro ? body.months : body.packs;
        const credits = pro ? 0 : quantity * CREDIT_PACK.invoices;
        let extension: ProExtension | null = null;
        if (pro) extension = await this.billing.extendPro(tx, subscription, quantity, now);

        let paymentId: string;
        try {
          const [payment] = await tx
            .insert(subscriptionPayments)
            .values({
              userId: id,
              purpose: body.purpose,
              quantity,
              amount: body.amount,
              currency: body.currency,
              status: "succeeded",
              provider: MANUAL,
              confirmedAt: now,
              grantedFrom: extension?.grantedFrom ?? null,
              grantedUntil: extension?.grantedUntil ?? null,
              creditsGranted: credits,
              method: body.method,
              externalReference: body.reference,
              paidAt: nairobiDayStart(body.paidAt),
              recordedBy: context.adminId,
              note: body.note ?? null,
            })
            .returning({ id: subscriptionPayments.id });
          paymentId = payment!.id;
        } catch (error) {
          // Two admins recording the same reference at once: the index decides.
          if (isUniqueViolation(error, "subscription_payments_manual_reference")) {
            throw this.duplicateReference();
          }
          throw error;
        }

        const details = { source: "manual", method: body.method };
        if (extension) {
          await this.billing.recordProEvent(tx, subscription.id, extension, {
            paymentId,
            details: { ...details, months: quantity },
          });
        } else {
          await this.billing.recordCreditsAdded(tx, subscription.id, credits, {
            paymentId,
            details: { ...details, packs: quantity },
          });
        }

        const after = await this.state(tx, extension?.subscription ?? subscription, now);
        const result: AdminPaymentRecorded = { paymentId, replayed: false, subscription: after };
        await key.save(tx, result);
        return {
          changes: {
            payment: {
              id: paymentId,
              purpose: body.purpose,
              quantity,
              amount: body.amount,
              currency: body.currency,
              method: body.method,
              reference: body.reference,
              paidAt: body.paidAt,
            },
            ...this.stateDiff(before, after),
          },
          result,
        };
      }),
    );
  }

  /** Recording money or gifts for your own account is refused, so no admin can self-deal. */
  private refuseSelf(context: AdminActionContext, id: string): void {
    if (id === context.adminId) {
      throw conflict(
        "CANNOT_GRANT_SELF",
        "You can't record payments, gifts or limit changes for your own account.",
      );
    }
  }

  private duplicateReference() {
    return conflict(
      "DUPLICATE_REFERENCE",
      "A manual payment with this method and reference is already recorded.",
    );
  }

  /** The plan as the account sees it at `now`, read inside the action's transaction. */
  private async state(
    tx: Transaction,
    subscription: SubscriptionRow,
    now: Date,
  ): Promise<AdminSubscriptionState> {
    const entitlement = { anchorAt: subscription.anchorAt, paidMonths: subscription.paidMonths };
    return {
      plan: planAt(subscription.anchorAt, subscription.paidMonths, now),
      status: subscriptionStatus(entitlement, now),
      anchorAt: iso(subscription.anchorAt),
      paidMonths: subscription.paidMonths,
      paidUntil: iso(subscription.paidUntil),
      cancelledAt: iso(subscription.cancelledAt),
      credits: await this.allowance.credits(tx, subscription.userId),
    };
  }

  private stateDiff(before: AdminSubscriptionState, after: AdminSubscriptionState) {
    return {
      paidUntil: diff(before.paidUntil, after.paidUntil),
      paidMonths: diff(before.paidMonths, after.paidMonths),
      credits: diff(before.credits, after.credits),
    };
  }

  /**
   * Runs `run` once per Idempotency-Key. A repeat of the same request answers the stored
   * result with `replayed: true` and changes nothing; the same key with a different
   * request is refused (409 IDEMPOTENCY_MISMATCH, audited). The key row is written in the
   * action's transaction by `claim`, so a failed action leaves no key and can be retried.
   * Two requests racing with one key: the second waits on the first's insert, then replays.
   */
  private async idempotent<T extends { replayed: boolean }>(
    context: AdminActionContext,
    target: ActionTarget,
    body: object,
    key: string | undefined,
    run: (steps: KeySteps<T>) => Promise<T>,
  ): Promise<T> {
    if (!key) return run({ claim: async () => {}, save: async () => {} });
    const idempotency: Idempotency = {
      key,
      action: target.action,
      hash: createHash("sha256")
        .update(JSON.stringify({ action: target.action, id: target.target.id, body }))
        .digest("hex"),
    };
    const stored = await this.storedResponse<T>(context, target, idempotency);
    if (stored) return stored;
    const thisKey = and(
      eq(adminIdempotencyKeys.adminUserId, context.adminId),
      eq(adminIdempotencyKeys.key, key),
    );
    try {
      return await run({
        claim: async (tx) => {
          const [claimed] = await tx
            .insert(adminIdempotencyKeys)
            .values({
              adminUserId: context.adminId,
              key,
              action: target.action,
              requestHash: idempotency.hash,
            })
            .onConflictDoNothing()
            .returning({ key: adminIdempotencyKeys.key });
          if (!claimed) throw new IdempotencyKeyTaken();
        },
        save: async (tx, result) => {
          await tx.update(adminIdempotencyKeys).set({ response: result }).where(thisKey);
        },
      });
    } catch (error) {
      if (!(error instanceof IdempotencyKeyTaken)) throw error;
      const replay = await this.storedResponse<T>(context, target, idempotency);
      if (!replay) throw error;
      return replay;
    }
  }

  private async storedResponse<T extends { replayed: boolean }>(
    context: AdminActionContext,
    target: ActionTarget,
    idempotency: Idempotency,
  ): Promise<T | null> {
    const [row] = await this.connection.db
      .select()
      .from(adminIdempotencyKeys)
      .where(
        and(
          eq(adminIdempotencyKeys.adminUserId, context.adminId),
          eq(adminIdempotencyKeys.key, idempotency.key),
        ),
      );
    if (!row?.response) return null;
    if (row.requestHash !== idempotency.hash) {
      // Audited like any refusal.
      await this.actions.performWith(context, target, async (): Promise<ActionOutcome<never>> => {
        throw conflict(
          "IDEMPOTENCY_MISMATCH",
          "This Idempotency-Key was already used for a different request.",
        );
      });
    }
    return { ...(row.response as T), replayed: true };
  }
}
