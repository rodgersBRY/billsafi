import { z } from "zod";
import { createBusinessSchema } from "./businesses.js";
import { createClientSchema } from "./clients.js";
import { invoiceDetailsSchema } from "./invoices.js";

/** What the public generator sends after sign-up (D056). */
export const importGuestInvoiceSchema = z.object({
  business: createBusinessSchema,
  client: createClientSchema,
  invoice: invoiceDetailsSchema.refine((invoice) => invoice.items.length > 0, {
    path: ["items"],
    message: "Add at least one line item",
  }),
  /** The generator's anonymous id, so the journey can be joined. Ignored when not a UUID. */
  anonymousId: z.uuid().optional().catch(undefined),
});
export type ImportGuestInvoiceInput = z.input<typeof importGuestInvoiceSchema>;
export type ImportGuestInvoice = z.output<typeof importGuestInvoiceSchema>;

export interface ImportGuestInvoiceResult {
  businessId: string;
  invoiceId: string;
  /** True when the account already had a business and typed business details were not used. */
  usedExistingBusiness: boolean;
}
