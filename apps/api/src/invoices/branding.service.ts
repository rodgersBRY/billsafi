import { Inject, Injectable } from "@nestjs/common";
import type { Invoice, PublicInvoice } from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
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
    return toPublicInvoice(invoice, await this.showBranding(businessId));
  }

  /** "Created with BillSafi" shows for Free accounts only (D052). */
  async showBranding(businessId: string): Promise<boolean> {
    const [business] = await this.connection.db
      .select({ ownerUserId: schema.businesses.ownerUserId })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId));
    return !(await this.allowance.isPro(business!.ownerUserId));
  }

  logoByKey(businessId: string, key: string | null): Promise<InvoiceLogo | null> {
    return key ? this.businesses.findLogo(businessId, key) : Promise.resolve(null);
  }

  /** The logo the invoice was issued with, or the current one while Draft. */
  async logo(businessId: string, invoice: Invoice): Promise<InvoiceLogo | null> {
    return this.logoByKey(businessId, invoice.business.logoKey);
  }
}
