import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import { and, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import {
  addCalendarDays,
  fillPeriodPlaceholders,
  nairobiDate,
  planRun,
  proPeriodAt,
} from "@billsafi/domain";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { DATABASE } from "../database/database.module.js";
import type { Transaction } from "../database/transaction.js";
import { InvoicesService } from "../invoices/invoices.service.js";
import { MAILER } from "../mail/mail.module.js";
import type { Mailer } from "../mail/mailer.js";
import { recurringInvoiceEmail, type RecurringRunOutcome } from "../mail/templates.js";
import { discountOf, scheduleState } from "./recurring.mapper.js";

const { recurringInvoices, recurringInvoiceItems, clients, businesses, subscriptions, users } =
  schema;

/** Schedules looked at per run, so a backlog spreads over several runs. */
const BATCH = 200;

interface Made {
  userId: string;
  businessId: string;
  invoiceId: string;
  outcome: RecurringRunOutcome;
  clientName: string;
  invoiceNumber: string | null;
  currency: string;
  total: string;
  skipped: number;
}

export interface RunSummary {
  created: number;
  paused: number;
  ended: number;
}

/** Turns due schedules into invoices (D082). Each schedule runs in its own transaction. */
@Injectable()
export class RecurringRunner {
  private readonly logger = new Logger(RecurringRunner.name);

  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly invoices: InvoicesService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Pick<Env, "WEB_ORIGIN">,
  ) {}

  private get db() {
    return this.connection.db;
  }

  async runDue(now = new Date()): Promise<RunSummary> {
    const today = nairobiDate(now);
    // Schedules paused only because Pro ended are checked too, so they restart with Pro.
    const due = await this.db
      .select({ id: recurringInvoices.id })
      .from(recurringInvoices)
      .where(
        sql`(${recurringInvoices.status} = 'active' and ${recurringInvoices.nextRunDate} <= ${today})
          or (${recurringInvoices.status} = 'paused' and ${recurringInvoices.pausedReason} = 'pro_ended')`,
      )
      .orderBy(recurringInvoices.nextRunDate)
      .limit(BATCH);

    const summary: RunSummary = { created: 0, paused: 0, ended: 0 };
    for (const { id } of due) {
      try {
        const result = await this.runOne(id, now);
        if (result === "paused") summary.paused++;
        else if (result === "ended") summary.ended++;
        else if (result) summary.created++;
      } catch (error) {
        this.logger.error(`Recurring invoice ${id} failed: ${String(error)}`);
      }
    }
    return summary;
  }

  /** Runs one schedule and emails the user after the commit. Returns what it made, or why it stopped. */
  async runOne(id: string, now: Date): Promise<Made | "paused" | "ended" | null> {
    const result = await this.generate(id, now);
    if (result && typeof result === "object") await this.notify(result);
    return result;
  }

  private async generate(id: string, now: Date): Promise<Made | "paused" | "ended" | null> {
    const today = nairobiDate(now);
    return this.db.transaction(async (tx) => {
      const [schedule] = await tx
        .select()
        .from(recurringInvoices)
        .where(eq(recurringInvoices.id, id))
        .for("update", { skipLocked: true });
      if (!schedule || schedule.status === "ended") return null;
      const set = (values: Partial<typeof recurringInvoices.$inferInsert>) =>
        tx.update(recurringInvoices).set(values).where(eq(recurringInvoices.id, id));

      const [business] = await tx
        .select({ userId: businesses.ownerUserId })
        .from(businesses)
        .where(eq(businesses.id, schedule.businessId));
      const userId = business!.userId;
      const pro = await this.isPro(tx, userId, now);

      if (schedule.status === "paused") {
        if (schedule.pausedReason !== "pro_ended" || !pro) return null;
        await set({ status: "active", pausedReason: null });
      } else if (!pro) {
        await set({ status: "paused", pausedReason: "pro_ended" });
        return "paused";
      }

      const [client] = await tx
        .select({ name: clients.name, archivedAt: clients.archivedAt })
        .from(clients)
        .where(eq(clients.id, schedule.clientId));
      if (client!.archivedAt) {
        await set({ status: "paused", pausedReason: "client_archived" });
        return "paused";
      }

      const plan = planRun(scheduleState(schedule), today);
      if (plan.kind === "wait") return null;
      if (plan.kind === "end") {
        await set({ status: "ended", nextRunDate: null });
        return "ended";
      }

      const items = await tx
        .select()
        .from(recurringInvoiceItems)
        .where(eq(recurringInvoiceItems.recurringInvoiceId, id))
        .orderBy(recurringInvoiceItems.position);
      const fill = (text: string) => fillPeriodPlaceholders(text, plan.periodDate);
      // Issued today even when catching up, so the due date never starts in the past.
      let invoice = await this.invoices.createDraft(
        schedule.businessId,
        {
          clientId: schedule.clientId,
          invoiceNumber: null,
          issueDate: today,
          dueDate: addCalendarDays(today, schedule.paymentTermsDays),
          items: items.map((item) => ({
            description: fill(item.description),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            savedItemId: item.savedItemId,
          })),
          discount: discountOf(schedule),
          taxRate: schedule.taxRate,
          paymentInstructions: schedule.paymentInstructions,
          notes: schedule.notes === null ? null : fill(schedule.notes),
        },
        tx,
        { recurringInvoiceId: id, periodDate: plan.periodDate },
      );

      let outcome: RecurringRunOutcome = "draft";
      if (schedule.mode === "ready") {
        try {
          invoice = await this.invoices.markReady(userId, schedule.businessId, invoice.id, tx);
          outcome = "ready";
        } catch (error) {
          // Out of allowance: keep the draft and tell the user rather than skip the period.
          if (!isAllowanceReached(error)) throw error;
          outcome = "allowance_reached";
        }
      }

      await set({
        generatedCount: schedule.generatedCount + 1,
        nextIndex: plan.nextIndex,
        nextRunDate: plan.nextRunDate,
        status: plan.nextRunDate === null ? "ended" : "active",
        lastRunAt: now,
      });
      return {
        userId,
        businessId: schedule.businessId,
        invoiceId: invoice.id,
        outcome,
        clientName: client!.name,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        total: invoice.total,
        skipped: plan.skipped,
      };
    });
  }

  private async isPro(tx: Transaction, userId: string, at: Date) {
    const [subscription] = await tx
      .select({ anchorAt: subscriptions.anchorAt, paidMonths: subscriptions.paidMonths })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return Boolean(
      subscription?.anchorAt && proPeriodAt(subscription.anchorAt, subscription.paidMonths, at),
    );
  }

  /** A failed send is logged; the invoice stands. */
  private async notify(made: Made) {
    try {
      const [user] = await this.db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(and(eq(users.id, made.userId), sql`${users.banned} is not true`));
      if (!user) return;
      const url = new URL(`/${made.businessId}/invoices/${made.invoiceId}`, this.env.WEB_ORIGIN)
        .href;
      await this.mailer.send(recurringInvoiceEmail(user.email, user.name, made, url), {
        operation: "recurring_invoice_email",
        accountId: made.userId,
      });
    } catch (error) {
      this.logger.warn(`Recurring invoice email for ${made.invoiceId} failed: ${String(error)}`);
    }
  }
}

function isAllowanceReached(error: unknown): boolean {
  if (!(error instanceof ConflictException)) return false;
  const body = error.getResponse();
  return typeof body === "object" && (body as { code?: string }).code === "ALLOWANCE_REACHED";
}
