import { calculateInvoice, type InvoiceCalculation } from "@billsafi/domain";

export interface EditorItem {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

export type Discount = { type: "fixed" | "percentage"; value: string } | null;

export const DECIMAL = /^\d+(\.\d+)?$/;

/** React keys only; never rendered, so they need not match between server and client. */
let itemKeys = 0;

export function newItem(item?: Partial<EditorItem>): EditorItem {
  itemKeys += 1;
  return {
    key: itemKeys,
    description: item?.description ?? "",
    quantity: item?.quantity ?? "1",
    unitPrice: item?.unitPrice ?? "",
  };
}

/** Preview totals tolerate half-typed numbers; validation happens on save. */
export function previewTotals(
  items: EditorItem[],
  discount: Discount,
  taxRate: string | null,
): { totals: InvoiceCalculation | null; discountError: boolean } {
  const clean = (value: string) => (DECIMAL.test(value.trim()) ? value.trim() : "0");
  try {
    return {
      totals: calculateInvoice({
        items: items.map((item) => ({
          quantity: clean(item.quantity),
          unitPrice: clean(item.unitPrice),
        })),
        discount: discount ? { type: discount.type, value: clean(discount.value) } : null,
        taxRate: taxRate ? clean(taxRate) : null,
      }),
      discountError: false,
    };
  } catch {
    return { totals: null, discountError: true };
  }
}

/** The discount row label shown on the invoice preview, or null when there is no discount. */
export function discountLabel(discount: Discount): string | null {
  if (!discount) return null;
  return discount.type === "percentage" ? `Discount (${discount.value || 0}%)` : "Discount";
}
