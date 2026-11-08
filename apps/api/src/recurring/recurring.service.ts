import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { SaveRecurringInvoice } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, desc, eq, inArray, schema } from "@billsafi/db";
import {
  calculateInvoice,
  DiscountExceedsSubtotalError,
  nairobiDate,
  upcomingRunDates,
} from "@billsafi/domain";
import { AllowanceService } from "../billing/allowance.service.js";
import { DATABASE } from "../database/database.module.js";
import type { Executor, Transaction } from "../database/transaction.js";
import { SavedItemsService } from "../items/saved-items.service.js";
import { scheduleState, toRecurringInvoice, toRecurringSummary } from "./recurring.mapper.js";

const { recurringInvoices, recurringInvoiceItems, clients, businesses, invoices } = schema;

type ScheduleRow = typeof recurringInvoices.$inferSelect;

function invalid(path: string, message: string): BadRequestException {
  return new BadRequestException({ message, issues: [{ path, message }] });
}

const ended = () => new ConflictException("This recurring invoice has ended");

/** Recurring schedules (D082). Making or changing one needs Pro; pausing and ending don't. */
@Injectable()
export class RecurringService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly allowance: AllowanceService,
    private readonly savedItems: SavedItemsService,
  ) {}

  private get db() {
    return this.connection.db;
  }

  async list(businessId: string) {
    const rows = await this.db
      .select({ schedule: recurringInvoices, clientName: clients.name })
      .from(recurringInvoices)
      .innerJoin(clients, eq(clients.id, recurringInvoices.clientId))
      .where(eq(recurringInvoices.businessId, businessId))
      .orderBy(desc(recurringInvoices.updatedAt));
    if (rows.length === 0) return [];
    const items = await this.db
      .select()
      .from(recurringInvoiceItems)
      .where(
        inArray(
          recurringInvoiceItems.recurringInvoiceId,
          rows.map((row) => row.schedule.id),
        ),
      );
    return rows.map((row) =>
      toRecurringSummary(
        row.schedule,
        row.clientName,
        items.filter((item) => item.recurringInvoiceId === row.schedule.id),
      ),
    );
  }

  get(businessId: string, id: string) {
    return this.load(this.db, businessId, id);
  }

  async create(userId: string, businessId: string, input: SaveRecurringInvoice) {
    await this.requirePro(userId);
    return this.db.transaction(async (tx) => {
      await this.activeClient(tx, businessId, input.clientId);
      this.checkStart(input.startDate);
      this.calculate(input);
      const [business] = await tx
        .select({ currency: businesses.defaultCurrency })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      const [schedule] = await tx
        .insert(recurringInvoices)
        .values({
          businessId,
          ...this.columns(input),
          currency: business!.currency,
          nextIndex: 0,
          nextRunDate: input.startDate,
        })
        .returning();
      await this.replaceItems(tx, businessId, schedule!.id, input);
      return this.load(tx, businessId, schedule!.id);
    });
  }

  /** Changes apply to future runs only. A new start date or frequency restarts the count of dates. */
  async update(userId: string, businessId: string, id: string, input: SaveRecurringInvoice) {
    await this.requirePro(userId);
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, businessId, id);
      if (current.status === "ended") throw ended();
      if (input.clientId !== current.clientId) {
        await this.activeClient(tx, businessId, input.clientId);
      }
      const restart =
        input.startDate !== current.startDate || input.frequency !== current.frequency;
      if (restart) this.checkStart(input.startDate);
      this.calculate(input);

      const next: ScheduleRow = {
        ...current,
        ...this.columns(input),
        nextIndex: restart ? 0 : current.nextIndex,
      };
      const [nextRunDate = null] = upcomingRunDates(scheduleState(next), 1);
      await tx
        .update(recurringInvoices)
        .set({
          ...this.columns(input),
          nextIndex: next.nextIndex,
          nextRunDate,
          ...(nextRunDate === null && { status: "ended" as const, pausedReason: null }),
        })
        .where(eq(recurringInvoices.id, id));
      await this.replaceItems(tx, businessId, id, input);
      return this.load(tx, businessId, id);
    });
  }

  async pause(businessId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, businessId, id);
      if (current.status === "ended") throw ended();
      if (current.status === "active") {
        await tx
          .update(recurringInvoices)
          .set({ status: "paused", pausedReason: "user" })
          .where(eq(recurringInvoices.id, id));
      }
      return this.load(tx, businessId, id);
    });
  }

  /** Missed periods are not backfilled: the next run makes only the latest one (D082). */
  async resume(userId: string, businessId: string, id: string) {
    await this.requirePro(userId);
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, businessId, id);
      if (current.status === "ended") throw ended();
      if (current.status === "paused") {
        const [client] = await tx
          .select({ archivedAt: clients.archivedAt })
          .from(clients)
          .where(eq(clients.id, current.clientId));
        if (client?.archivedAt) {
          throw new ConflictException("This client is archived. Restore the client first.");
        }
        await tx
          .update(recurringInvoices)
          .set({ status: "active", pausedReason: null })
          .where(eq(recurringInvoices.id, id));
      }
      return this.load(tx, businessId, id);
    });
  }

  /** Passes over the next date without making an invoice. */
  async skip(businessId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, businessId, id);
      if (current.status === "ended") throw ended();
      const nextIndex = current.nextIndex + 1;
      const [nextRunDate = null] = upcomingRunDates(scheduleState({ ...current, nextIndex }), 1);
      await tx
        .update(recurringInvoices)
        .set({
          nextIndex,
          nextRunDate,
          ...(nextRunDate === null && { status: "ended" as const, pausedReason: null }),
        })
        .where(eq(recurringInvoices.id, id));
      return this.load(tx, businessId, id);
    });
  }

  /** Stops the schedule for good. Invoices it already made stay as they are. */
  async end(businessId: string, id: string) {
    return this.db.transaction(async (tx) => {
      await this.lock(tx, businessId, id);
      await tx
        .update(recurringInvoices)
        .set({ status: "ended", pausedReason: null, nextRunDate: null })
        .where(eq(recurringInvoices.id, id));
      return this.load(tx, businessId, id);
    });
  }

  async load(db: Executor, businessId: string, id: string) {
    const [row] = await db
      .select({ schedule: recurringInvoices, clientName: clients.name })
      .from(recurringInvoices)
      .innerJoin(clients, eq(clients.id, recurringInvoices.clientId))
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.businessId, businessId)));
    if (!row) throw new NotFoundException("Recurring invoice not found");
    const items = await db
      .select()
      .from(recurringInvoiceItems)
      .where(eq(recurringInvoiceItems.recurringInvoiceId, id))
      .orderBy(asc(recurringInvoiceItems.position));
    const made = await db
      .select({
        id: invoices.id,
        status: invoices.status,
        invoiceNumber: invoices.invoiceNumber,
        periodDate: invoices.periodDate,
        total: invoices.total,
      })
      .from(invoices)
      .where(and(eq(invoices.businessId, businessId), eq(invoices.recurringInvoiceId, id)))
      .orderBy(desc(invoices.periodDate))
      .limit(24);
    return toRecurringInvoice(row.schedule, row.clientName, items, made);
  }

  private async requirePro(userId: string) {
    if (!(await this.allowance.isPro(userId))) {
      throw new ConflictException({
        code: "PRO_REQUIRED",
        message: "Recurring invoices are part of Pro. Upgrade to set one up.",
      });
    }
  }

  private checkStart(startDate: string) {
    if (startDate < nairobiDate(new Date())) {
      throw invalid("startDate", "Start date can't be in the past");
    }
  }

  private calculate(input: SaveRecurringInvoice) {
    try {
      return calculateInvoice(input);
    } catch (error) {
      if (error instanceof DiscountExceedsSubtotalError) {
        throw invalid("discount.value", error.message);
      }
      throw error;
    }
  }

  private columns(input: SaveRecurringInvoice) {
    return {
      clientId: input.clientId,
      frequency: input.frequency,
      mode: input.mode,
      startDate: input.startDate,
      endDate: input.endDate,
      maxCount: input.maxCount,
      paymentTermsDays: input.paymentTermsDays,
      discountType: input.discount?.type ?? null,
      discountValue: input.discount?.value ?? null,
      taxRate: input.taxRate,
      paymentInstructions: input.paymentInstructions ?? null,
      notes: input.notes ?? null,
    };
  }

  private async replaceItems(
    tx: Transaction,
    businessId: string,
    id: string,
    input: SaveRecurringInvoice,
  ) {
    await tx.delete(recurringInvoiceItems).where(eq(recurringInvoiceItems.recurringInvoiceId, id));
    const links = await this.savedItems.ownedLinks(
      tx,
      businessId,
      input.items.map((item) => item.savedItemId),
    );
    await tx.insert(recurringInvoiceItems).values(
      input.items.map((item, index) => ({
        businessId,
        recurringInvoiceId: id,
        position: index + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        savedItemId: links[index]!,
      })),
    );
  }

  private async lock(tx: Transaction, businessId: string, id: string) {
    const [row] = await tx
      .select()
      .from(recurringInvoices)
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.businessId, businessId)))
      .for("update");
    if (!row) throw new NotFoundException("Recurring invoice not found");
    return row;
  }

  private async activeClient(tx: Transaction, businessId: string, clientId: string) {
    const [client] = await tx
      .select({ archivedAt: clients.archivedAt })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)));
    if (!client) throw invalid("clientId", "Choose a client");
    if (client.archivedAt) throw invalid("clientId", "This client is archived");
  }
}
