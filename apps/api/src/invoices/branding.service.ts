import { Inject, Injectable } from "@nestjs/common";
import type { Invoice, PublicInvoice } from "@tallynest/contracts";
import { type DatabaseConnection, eq, schema } from "@tallynest/db";
import { AllowanceService } from "../billing/allowance.service.js";
import { BusinessesService } from "../businesses/businesses.service.js";
import { DATABASE } from "../database/database.module.js";
import { toPublicInvoice } from "./links.service.js";

export interface InvoiceLogo {
  data: Buffer;
  contentType: string;
}

/** What clients see around an invoice: the business logo and the Free-plan footer (D052). */
@Injectable()
export class BrandingService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly allowance: AllowanceService,
    private readonly businesses: BusinessesService,
  ) {}

  async present(businessId: string, invoice: Invoice): Promise<PublicInvoice> {
    const [business] = await this.connection.db
      .select({ ownerUserId: schema.businesses.ownerUserId })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId));
    const pro = await this.allowance.isPro(business!.ownerUserId);
    return toPublicInvoice(invoice, !pro);
  }

  /** The logo the invoice was issued with, or the current one while Draft. */
  async logo(businessId: string, invoice: Invoice): Promise<InvoiceLogo | null> {
    const key = invoice.business.logoKey;
    return key ? this.businesses.findLogo(businessId, key) : null;
  }
}
