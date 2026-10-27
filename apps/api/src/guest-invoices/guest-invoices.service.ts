import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { ImportGuestInvoice, ImportGuestInvoiceResult } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, eq, isNull, schema } from "@billsafi/db";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import { BusinessesService } from "../businesses/businesses.service.js";
import { ClientsService } from "../clients/clients.service.js";
import { DATABASE } from "../database/database.module.js";
import { InvoicesService } from "../invoices/invoices.service.js";

const { users, clients } = schema;

type Issue = { path: string; message: string };

/** Draft errors name draft fields; the import form nests them under `invoice`. */
function underInvoice(error: unknown): unknown {
  if (!(error instanceof BadRequestException)) return error;
  const response = error.getResponse() as { message?: string; issues?: Issue[] };
  if (!Array.isArray(response.issues)) return error;
  return new BadRequestException({
    ...response,
    issues: response.issues.map((issue) => ({ ...issue, path: `invoice.${issue.path}` })),
  });
}

/** Saves a draft built on the public generator into the signed-in account (D056). */
@Injectable()
export class GuestInvoicesService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly businesses: BusinessesService,
    private readonly clients: ClientsService,
    private readonly invoices: InvoicesService,
    private readonly recorder: ActivityRecorder,
  ) {}

  async import(userId: string, input: ImportGuestInvoice): Promise<ImportGuestInvoiceResult> {
    const result = await this.connection.db.transaction(async (tx) => {
      // Two imports at the same moment must not both create a first business.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");

      const [existing] = await this.businesses.listOwned(userId, tx);
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
        .orderBy(asc(clients.createdAt))
        .limit(1);
      const client = sameClient ?? (await this.clients.create(business.id, input.client, tx));

      const invoice = await this.invoices
        .createDraft(business.id, { ...input.invoice, clientId: client.id }, tx)
        .catch((error: unknown) => {
          throw underInvoice(error);
        });
      return {
        businessId: business.id,
        invoiceId: invoice.id,
        usedExistingBusiness: existing !== undefined,
      };
    });
    // After the commit, so a rolled back import is never counted (D066).
    this.recorder.productEvent(
      "guest_invoice_imported",
      { usedExistingBusiness: result.usedExistingBusiness },
      { accountId: userId, anonymousId: input.anonymousId, invoiceId: result.invoiceId },
    );
    return result;
  }
}
