import { z } from "zod";
import { decimalString, INVOICE_LIMITS } from "./invoices.js";
import { requiredText } from "./fields.js";

/** A reusable line item. Same limits as an invoice line so a saved item always fits one (D080). */
export const createSavedItemSchema = z.object({
  description: requiredText("Description", INVOICE_LIMITS.descriptionLength),
  quantity: decimalString(
    "Quantity",
    INVOICE_LIMITS.minQuantity,
    INVOICE_LIMITS.maxQuantity,
  ).default("1"),
  unitPrice: decimalString("Unit price", 0, INVOICE_LIMITS.maxUnitPrice),
});
export type CreateSavedItemInput = z.input<typeof createSavedItemSchema>;

export const updateSavedItemSchema = createSavedItemSchema.partial();
export type UpdateSavedItemInput = z.input<typeof updateSavedItemSchema>;

export interface SavedItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  useCount: number;
  lastUsedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
