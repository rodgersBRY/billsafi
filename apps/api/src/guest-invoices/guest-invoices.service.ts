import { Inject, Injectable } from "@nestjs/common";
import type { ImportGuestInvoice, ImportGuestInvoiceResult } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, eq, isNull, schema } from "@billsafi/db";
import { BusinessesService } from "../businesses/businesses.service.js";
import { ClientsService } from "../clients/clients.service.js";
import { DATABASE } from "../database/database.module.js";
import { InvoicesService } from "../invoices/invoices.service.js";

const { users, businesses, clients } = schema;

/** Saves a draft built on the public generator into the signed-in account (D056). */
@Injectable()
export class GuestInvoicesService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly businesses: BusinessesService,
    private readonly clients: ClientsService,
    private readonly invoices: InvoicesService,
  ) {}

  async import(userId: string, input: ImportGuestInvoice): Promise<ImportGuestInvoiceResult> {
    return this.connection.db.transaction(async (tx) => {
      // Two imports at the same moment must not both create a first business.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");

      const [existing] = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.ownerUserId, userId))
        .orderBy(asc(businesses.createdAt))
        .limit(1);
      const business = existing ?? (await this.businesses.create(userId, input.business, tx));

      const [sameClient] = await tx
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.businessId, business.id),
            eq(clients.phone, input.client.phone),
            isNull(clients.archivedAt),
          ),
        )
        .limit(1);
      const client = sameClient ?? (await this.clients.create(business.id, input.client, tx));

      const invoice = await this.invoices.createDraft(
        business.id,
        { ...input.invoice, clientId: client.id },
        tx,
      );
      return {
        businessId: business.id,
        invoiceId: invoice.id,
        usedExistingBusiness: existing !== undefined,
      };
    });
  }
}
