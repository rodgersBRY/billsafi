import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CorrectPayment, Payment, RecordPayment } from "@tallynest/contracts";
import {
  and,
  asc,
  type Database,
  type DatabaseConnection,
  eq,
  inArray,
  isNull,
  ne,
  schema,
  sql,
} from "@tallynest/db";
import { money, nairobiDate, paymentStatus, sumPayments } from "@tallynest/domain";
import { DATABASE } from "../database/database.module.js";
import { InvoicesService } from "./invoices.service.js";

const { invoices, invoicePayments, paymentChanges } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type PaymentRow = typeof invoicePayments.$inferSelect;

function invalid(path: string, message: string): BadRequestException {
  return new BadRequestException({ message, issues: [{ path, message }] });
}

function values(row: PaymentRow) {
  return {
    amount: row.amount,
    method: row.method,
    paymentDate: row.paymentDate,
    reference: row.reference,
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly invoices: InvoicesService,
  ) {}

  /** Payment records with their correction and reversal history (D049). */
  async list(businessId: string, invoiceId: string): Promise<Payment[]> {
    const db = this.connection.db;
    await this.invoices.load(db, businessId, invoiceId);
    const payments = await db
      .select()
      .from(invoicePayments)
      .where(
        and(eq(invoicePayments.invoiceId, invoiceId), eq(invoicePayments.businessId, businessId)),
      )
      .orderBy(asc(invoicePayments.paymentDate), asc(invoicePayments.createdAt));
    const changes = payments.length
      ? await db
          .select()
          .from(paymentChanges)
          .where(
            inArray(
              paymentChanges.paymentId,
              payments.map((payment) => payment.id),
            ),
          )
          .orderBy(asc(paymentChanges.createdAt))
      : [];
    return payments.map((payment) => ({
      id: payment.id,
      ...values(payment),
      reversedAt: payment.reversedAt?.toISOString() ?? null,
      recordedAt: payment.createdAt.toISOString(),
      changes: changes
        .filter((change) => change.paymentId === payment.id)
        .map((change) => ({
          kind: change.kind,
          previousValues: change.previousValues,
          newValues: change.newValues,
          reason: change.reason,
          createdAt: change.createdAt.toISOString(),
        })),
    }));
  }

  /** Records a payment received outside TallyNest; it may not exceed the balance (D013). */
  async record(userId: string, businessId: string, invoiceId: string, input: RecordPayment) {
    return this.connection.db.transaction(async (tx) => {
      const invoice = await this.invoices.lockInvoice(tx, businessId, invoiceId);
      if (invoice.status === "draft") {
        throw new ConflictException("Mark the invoice as Ready before recording payments");
      }
      if (invoice.status === "cancelled") {
        throw new ConflictException("Payments can't be recorded on a cancelled invoice");
      }
      this.assertNotFuture(input.paymentDate);

      const paid = await this.effectiveTotal(tx, invoiceId);
      const balance = money(invoice.total).minus(paid);
      if (money(input.amount).greaterThan(balance)) {
        throw invalid(
          "amount",
          `The amount is more than the balance due of KES ${balance.toFixed(2)}`,
        );
      }

      await tx.insert(invoicePayments).values({
        businessId,
        invoiceId,
        ...input,
        reference: input.reference ?? null,
        recordedByUserId: userId,
      });
      await tx
        .update(invoices)
        .set({ paymentActivityAt: sql`coalesce(${invoices.paymentActivityAt}, now())` })
        .where(eq(invoices.id, invoiceId));
      await this.refreshStatus(tx, invoiceId, invoice.total);
      return this.invoices.load(tx, businessId, invoiceId);
    });
  }

  /**
   * Corrects a mistaken record with a required reason, keeping before and after
   * values. The corrected total may not exceed the invoice total (D043).
   */
  async correct(
    userId: string,
    businessId: string,
    invoiceId: string,
    paymentId: string,
    input: CorrectPayment,
  ) {
    return this.connection.db.transaction(async (tx) => {
      const invoice = await this.invoices.lockInvoice(tx, businessId, invoiceId);
      const payment = await this.findPayment(tx, businessId, invoiceId, paymentId);
      if (payment.reversedAt) throw new ConflictException("Reversed payments can't be corrected");
      this.assertNotFuture(input.paymentDate);

      const others = await this.effectiveTotal(tx, invoiceId, paymentId);
      if (money(others).plus(input.amount).greaterThan(invoice.total)) {
        throw invalid("amount", "Payments would add up to more than the invoice total");
      }

      const next = {
        amount: money(input.amount).toFixed(2),
        method: input.method,
        paymentDate: input.paymentDate,
        reference: input.reference ?? null,
      };
      await tx.insert(paymentChanges).values({
        businessId,
        paymentId,
        kind: "correction",
        previousValues: values(payment),
        newValues: next,
        reason: input.reason,
        actorUserId: userId,
      });
      await tx.update(invoicePayments).set(next).where(eq(invoicePayments.id, paymentId));
      await this.refreshStatus(tx, invoiceId, invoice.total);
      return this.invoices.load(tx, businessId, invoiceId);
    });
  }

  /**
   * Reverses an erroneous record: kept, marked reversed, and excluded from totals.
   * Bookkeeping only; no money moves (D043).
   */
  async reverse(
    userId: string,
    businessId: string,
    invoiceId: string,
    paymentId: string,
    reason: string,
  ) {
    return this.connection.db.transaction(async (tx) => {
      const invoice = await this.invoices.lockInvoice(tx, businessId, invoiceId);
      const payment = await this.findPayment(tx, businessId, invoiceId, paymentId);
      if (payment.reversedAt) return this.invoices.load(tx, businessId, invoiceId);

      await tx.insert(paymentChanges).values({
        businessId,
        paymentId,
        kind: "reversal",
        previousValues: values(payment),
        reason,
        actorUserId: userId,
      });
      await tx
        .update(invoicePayments)
        .set({ reversedAt: new Date() })
        .where(eq(invoicePayments.id, paymentId));
      await this.refreshStatus(tx, invoiceId, invoice.total);
      return this.invoices.load(tx, businessId, invoiceId);
    });
  }

  private assertNotFuture(paymentDate: string) {
    if (paymentDate > nairobiDate(new Date())) {
      throw invalid("paymentDate", "The payment date can't be in the future");
    }
  }

  private async findPayment(
    tx: Transaction,
    businessId: string,
    invoiceId: string,
    paymentId: string,
  ) {
    const [payment] = await tx
      .select()
      .from(invoicePayments)
      .where(
        and(
          eq(invoicePayments.id, paymentId),
          eq(invoicePayments.invoiceId, invoiceId),
          eq(invoicePayments.businessId, businessId),
        ),
      )
      .for("update");
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  private async effectiveTotal(tx: Transaction, invoiceId: string, excludePaymentId?: string) {
    const rows = await tx
      .select({ amount: invoicePayments.amount })
      .from(invoicePayments)
      .where(
        and(
          eq(invoicePayments.invoiceId, invoiceId),
          isNull(invoicePayments.reversedAt),
          excludePaymentId ? ne(invoicePayments.id, excludePaymentId) : undefined,
        ),
      );
    return sumPayments(rows.map((row) => row.amount));
  }

  /** Ready, Partially paid or Paid from effective payments; Paid may fall back (D043). */
  private async refreshStatus(tx: Transaction, invoiceId: string, total: string) {
    const paid = await this.effectiveTotal(tx, invoiceId);
    await tx
      .update(invoices)
      .set({ status: paymentStatus(total, paid) })
      .where(eq(invoices.id, invoiceId));
  }
}
