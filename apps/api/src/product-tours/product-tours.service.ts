import { Inject, Injectable } from "@nestjs/common";
import type {
  GettingStarted,
  ProductTourKey,
  ProductTourState,
  SaveProductTour,
} from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { DATABASE } from "../database/database.module.js";

const {
  userProductTours,
  businesses,
  clients,
  invoices,
  invoiceLinks,
  invoicePayments,
  businessPaymentInstructions,
} = schema;

type BusinessScopedTable =
  | typeof clients
  | typeof invoices
  | typeof invoiceLinks
  | typeof invoicePayments
  | typeof businessPaymentInstructions;

/** Saved tour progress and first-step checklist for an account (D057). */
@Injectable()
export class ProductToursService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async list(userId: string): Promise<ProductTourState[]> {
    const rows = await this.connection.db
      .select()
      .from(userProductTours)
      .where(eq(userProductTours.userId, userId));
    return rows.map((row) => ({
      key: row.tourKey as ProductTourKey,
      version: row.version,
      status: row.status,
      lastStep: row.lastStep,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async save(
    userId: string,
    key: ProductTourKey,
    input: SaveProductTour,
  ): Promise<ProductTourState> {
    const values = { version: input.version, status: input.status, lastStep: input.lastStep };
    const [row] = await this.connection.db
      .insert(userProductTours)
      .values({ userId, tourKey: key, ...values })
      .onConflictDoUpdate({
        target: [userProductTours.userId, userProductTours.tourKey],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return {
      key,
      version: row!.version,
      status: row!.status,
      lastStep: row!.lastStep,
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  async gettingStarted(userId: string): Promise<GettingStarted> {
    const owned = sql`(select ${businesses.id} from ${businesses} where ${businesses.ownerUserId} = ${userId})`;
    const done = (table: BusinessScopedTable) =>
      sql`exists (select 1 from ${table} where ${table.businessId} in ${owned})`;

    const { rows } = await this.connection.db.execute<GettingStarted & Record<string, boolean>>(sql`
      select
        ${done(clients)} as "addClient",
        ${done(invoices)} as "createInvoice",
        ${done(invoiceLinks)} as "shareInvoice",
        ${done(businessPaymentInstructions)} as "paymentInstructions",
        ${done(invoicePayments)} as "recordPayment"
    `);
    return rows[0]!;
  }
}
