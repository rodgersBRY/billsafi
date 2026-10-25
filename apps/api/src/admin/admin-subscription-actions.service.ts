import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AdminGrant,
  AdminGrantRecorded,
  AdminOverride,
  AdminOverrideResult,
  AdminOverrideRow,
  AdminPaymentRecorded,
  AdminProEnded,
  AdminRecordPayment,
  AdminSubscriptionState,
} from "@billsafi/contracts";
import { and, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import {
  addNairobiMonths,
  CREDIT_PACK,
  nairobiDate,
  proPeriodAt,
  subscriptionStatus,
} from "@billsafi/domain";
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
import { selectOverrides } from "./admin-overrides.js";
import { planAt } from "./admin-sql.js";

const {
  subscriptionPayments,
  adminIdempotencyKeys,
  accountGrants,
  subscriptionEvents,
  subscriptions,
  allowanceOverrides,
} = schema;

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
              // Like checkout, stamp this process's clock so rows from both paths order together.
              createdAt: now,
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

  /**
   * Gives Pro months or invoice credits at no charge. Pro months go through extendPro like
   * a payment, but keep an active run's cancellation: a gift is not a request to renew.
   */
  async grant(
    context: AdminActionContext,
    id: string,
    body: AdminGrant,
    idempotencyKey?: string,
  ): Promise<AdminGrantRecorded> {
    const target: ActionTarget = { action: "tenant.grant", target: { type: "account", id } };
    return this.idempotent(context, target, body, idempotencyKey, (key) =>
      this.actions.performWith(context, target, async (tx) => {
        await key.claim(tx);
        await this.actions.lockUser(tx, id);
        this.refuseSelf(context, id);
        const subscription = await this.allowance.lockAccount(tx, id);
        const now = new Date();
        const before = await this.state(tx, subscription, now);

        const extension =
          body.kind === "pro_months"
            ? await this.billing.extendPro(tx, subscription, body.quantity, now, {
                clearCancellation: false,
              })
            : null;
        const [grant] = await tx
          .insert(accountGrants)
          .values({
            userId: id,
            kind: body.kind,
            quantity: body.quantity,
            reason: body.reason,
            grantedBy: context.adminId,
            grantedFrom: extension?.grantedFrom ?? null,
            grantedUntil: extension?.grantedUntil ?? null,
            createdAt: now,
          })
          .returning({ id: accountGrants.id });
        await tx.insert(subscriptionEvents).values({
          subscriptionId: subscription.id,
          kind: "granted",
          grantId: grant!.id,
          details: {
            grant: body.kind,
            quantity: body.quantity,
            ...(extension && {
              renews: extension.kind === "renewed",
              grantedFrom: extension.grantedFrom.toISOString(),
              grantedUntil: extension.grantedUntil.toISOString(),
            }),
          },
        });

        const after = await this.state(tx, extension?.subscription ?? subscription, now);
        const result: AdminGrantRecorded = {
          grantId: grant!.id,
          replayed: false,
          subscription: after,
        };
        await key.save(tx, result);
        return {
          changes: {
            grant: { id: grant!.id, kind: body.kind, quantity: body.quantity },
            ...this.stateDiff(before, after),
          },
          result,
        };
      }),
    );
  }

  /**
   * Ends Pro at the end of the current Pro month by dropping the months after it. Pro is
   * counted in whole months and the allowance follows them, so it never ends mid-month.
   * Dropped months are not refunded here; support handles refunds by hand (D051).
   */
  async endPro(context: AdminActionContext, id: string): Promise<AdminProEnded> {
    return this.actions.performWith(
      context,
      { action: "tenant.end_pro", target: { type: "account", id } },
      async (tx) => {
        await this.actions.lockUser(tx, id);
        const subscription = await this.allowance.lockAccount(tx, id);
        const now = new Date();
        const period = subscription.anchorAt
          ? proPeriodAt(subscription.anchorAt, subscription.paidMonths, now)
          : null;
        if (!period) throw conflict("NOT_PRO", "This account isn't on Pro.");
        const paidMonths = period.index + 1;
        if (paidMonths === subscription.paidMonths) {
          throw conflict("ALREADY_ENDING", "Pro already ends at the end of the current Pro month.");
        }
        const before = await this.state(tx, subscription, now);
        const paidUntil = addNairobiMonths(subscription.anchorAt!, paidMonths);
        const [updated] = await tx
          .update(subscriptions)
          .set({ paidMonths, paidUntil })
          .where(eq(subscriptions.id, subscription.id))
          .returning();
        // Payments and grants whose windows ran past the new end keep what they bought in
        // granted_until and record where the run now really ends.
        const cut = sql`${paidUntil.toISOString()}::timestamptz`;
        const cutPayments = await tx
          .update(subscriptionPayments)
          .set({ endedEarlyAt: paidUntil })
          .where(
            and(
              eq(subscriptionPayments.userId, id),
              eq(subscriptionPayments.status, "succeeded"),
              eq(subscriptionPayments.purpose, "pro_month"),
              sql`${subscriptionPayments.grantedUntil} > ${cut}`,
              sql`(${subscriptionPayments.endedEarlyAt} is null or ${subscriptionPayments.endedEarlyAt} > ${cut})`,
            ),
          )
          .returning({
            id: subscriptionPayments.id,
            grantedFrom: subscriptionPayments.grantedFrom,
            grantedUntil: subscriptionPayments.grantedUntil,
          });
        const cutGrants = await tx
          .update(accountGrants)
          .set({ endedEarlyAt: paidUntil })
          .where(
            and(
              eq(accountGrants.userId, id),
              eq(accountGrants.kind, "pro_months"),
              sql`${accountGrants.grantedUntil} > ${cut}`,
              sql`(${accountGrants.endedEarlyAt} is null or ${accountGrants.endedEarlyAt} > ${cut})`,
            ),
          )
          .returning({
            id: accountGrants.id,
            grantedFrom: accountGrants.grantedFrom,
            grantedUntil: accountGrants.grantedUntil,
          });
        const window = (row: {
          id: string;
          grantedFrom: Date | null;
          grantedUntil: Date | null;
        }) => ({
          id: row.id,
          grantedFrom: iso(row.grantedFrom),
          grantedUntil: iso(row.grantedUntil),
        });
        await tx.insert(subscriptionEvents).values({
          subscriptionId: subscription.id,
          kind: "ended_by_admin",
          details: {
            paidMonths: { from: subscription.paidMonths, to: paidMonths },
            paidUntil: { from: before.paidUntil, to: paidUntil.toISOString() },
            endedEarly: { payments: cutPayments.map(window), grants: cutGrants.map(window) },
          },
        });
        const after = await this.state(tx, updated!, now);
        return { changes: this.stateDiff(before, after), result: { subscription: after } };
      },
    );
  }

  /** Raises the account's invoice limit for a while; it is counted only while active. */
  async addOverride(
    context: AdminActionContext,
    id: string,
    body: AdminOverride,
  ): Promise<AdminOverrideResult> {
    return this.actions.performWith(
      context,
      { action: "tenant.add_override", target: { type: "account", id } },
      async (tx) => {
        await this.actions.lockUser(tx, id);
        this.refuseSelf(context, id);
        const subscription = await this.allowance.lockAccount(tx, id);
        const now = new Date();
        const startsAt = body.startsAt ? new Date(body.startsAt) : now;
        const before = await this.allowance.usageFor(tx, id, subscription, now);
        const [created] = await tx
          .insert(allowanceOverrides)
          .values({
            userId: id,
            extraInvoices: body.extraInvoices,
            startsAt,
            expiresAt: new Date(body.expiresAt),
            reason: body.reason,
            createdBy: context.adminId,
            createdAt: now,
          })
          .returning({ id: allowanceOverrides.id });
        const result = await this.overrideResult(tx, created!.id, id, subscription, now);
        return {
          changes: {
            override: {
              id: created!.id,
              extraInvoices: body.extraInvoices,
              startsAt: startsAt.toISOString(),
              expiresAt: result.override.expiresAt,
            },
            limit: diff(before.limit, result.allowance.limit),
          },
          result,
        };
      },
    );
  }

  /** Ends an override early. The row stays, marked revoked, so the history is kept. */
  async revokeOverride(
    context: AdminActionContext,
    overrideId: string,
  ): Promise<AdminOverrideResult> {
    const [found] = await this.connection.db
      .select({ userId: allowanceOverrides.userId })
      .from(allowanceOverrides)
      .where(eq(allowanceOverrides.id, overrideId));
    // Audited against the account, so it shows in the tenant's history; unknown ids by id.
    const target: ActionTarget = found
      ? { action: "tenant.revoke_override", target: { type: "account", id: found.userId } }
      : { action: "tenant.revoke_override", target: { type: "override", id: overrideId } };
    return this.actions.performWith(context, target, async (tx) => {
      if (!found) throw new NotFoundException("Override not found");
      await this.actions.lockUser(tx, found.userId);
      const subscription = await this.allowance.lockAccount(tx, found.userId);
      const [override] = await tx
        .select()
        .from(allowanceOverrides)
        .where(eq(allowanceOverrides.id, overrideId))
        .for("update");
      const now = new Date();
      if (override!.revokedAt) {
        throw conflict("ALREADY_REVOKED", "This override has already been revoked.");
      }
      if (override!.expiresAt <= now) {
        throw conflict("OVERRIDE_EXPIRED", "This override has already expired.");
      }
      const before = await this.allowance.usageFor(tx, found.userId, subscription, now);
      await tx
        .update(allowanceOverrides)
        .set({ revokedAt: now, revokedBy: context.adminId, revokeReason: context.reason })
        .where(eq(allowanceOverrides.id, overrideId));
      const result = await this.overrideResult(tx, overrideId, found.userId, subscription, now);
      return {
        changes: {
          override: { id: overrideId, extraInvoices: override!.extraInvoices },
          revokedAt: diff(null, now.toISOString()),
          limit: diff(before.limit, result.allowance.limit),
        },
        result,
      };
    });
  }

  private async overrideResult(
    tx: Transaction,
    overrideId: string,
    userId: string,
    subscription: SubscriptionRow,
    now: Date,
  ): Promise<AdminOverrideResult> {
    const [override] = await selectOverrides(tx, now, sql`o.id = ${overrideId}`);
    const usage = await this.allowance.usageFor(tx, userId, subscription, now);
    return {
      override: override as AdminOverrideRow,
      allowance: {
        plan: usage.plan,
        used: usage.used,
        limit: usage.limit,
        periodEnd: usage.periodEnd,
      },
    };
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
