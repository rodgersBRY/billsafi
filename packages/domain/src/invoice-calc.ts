import { money, toMoneyString, type Money } from "./money.js";

export type DiscountType = "fixed" | "percentage";

export interface InvoiceCalculationInput {
  items: { quantity: string; unitPrice: string }[];
  discount?: { type: DiscountType; value: string } | null;
  /** Percentage, for example "16" for 16%. Omit or null when tax is off. */
  taxRate?: string | null;
}

export interface InvoiceCalculation {
  lineTotals: string[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
}

export class DiscountExceedsSubtotalError extends Error {
  constructor() {
    super("The discount cannot be more than the subtotal");
  }
}

const HUNDRED = money(100);

function rounded(value: Money): Money {
  return money(toMoneyString(value));
}

/**
 * Adopted calculation rules (D013, D042): round half up to two decimals at each
 * line total, the discount amount, and the tax amount; tax applies after the
 * single optional subtotal discount.
 */
export function calculateInvoice(input: InvoiceCalculationInput): InvoiceCalculation {
  const lines = input.items.map((item) => rounded(money(item.quantity).times(item.unitPrice)));
  const subtotal = lines.reduce((sum, line) => sum.plus(line), money(0));

  let discount = money(0);
  if (input.discount) {
    discount =
      input.discount.type === "fixed"
        ? rounded(money(input.discount.value))
        : rounded(subtotal.times(input.discount.value).dividedBy(HUNDRED));
  }
  if (discount.greaterThan(subtotal)) throw new DiscountExceedsSubtotalError();

  const taxable = subtotal.minus(discount);
  const tax = input.taxRate ? rounded(taxable.times(input.taxRate).dividedBy(HUNDRED)) : money(0);

  return {
    lineTotals: lines.map((line) => toMoneyString(line)),
    subtotal: toMoneyString(subtotal),
    discountAmount: toMoneyString(discount),
    taxAmount: toMoneyString(tax),
    total: toMoneyString(taxable.plus(tax)),
  };
}
