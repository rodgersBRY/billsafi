import { describe, expect, it } from "vitest";
import { calculateInvoice, DiscountExceedsSubtotalError } from "./invoice-calc.js";

describe("calculateInvoice", () => {
  it("multiplies quantity by unit price and sums rounded lines", () => {
    const result = calculateInvoice({
      items: [
        { quantity: "2", unitPrice: "15000" },
        { quantity: "1.5", unitPrice: "3333.33" },
      ],
    });
    expect(result.lineTotals).toEqual(["30000.00", "5000.00"]);
    expect(result.subtotal).toBe("35000.00");
    expect(result.discountAmount).toBe("0.00");
    expect(result.taxAmount).toBe("0.00");
    expect(result.total).toBe("35000.00");
  });

  it("rounds each line half up before summing", () => {
    // 3 × 3.375 = 10.125 rounds to 10.13; two lines give 20.26, not round(20.25).
    const result = calculateInvoice({
      items: [
        { quantity: "3", unitPrice: "3.375" },
        { quantity: "3", unitPrice: "3.375" },
      ],
    });
    expect(result.lineTotals).toEqual(["10.13", "10.13"]);
    expect(result.subtotal).toBe("20.26");
  });

  it("applies a fixed discount, then tax on the discounted amount", () => {
    const result = calculateInvoice({
      items: [{ quantity: "1", unitPrice: "50000" }],
      discount: { type: "fixed", value: "5000" },
      taxRate: "16",
    });
    expect(result.discountAmount).toBe("5000.00");
    expect(result.taxAmount).toBe("7200.00");
    expect(result.total).toBe("52200.00");
  });

  it("rounds a percentage discount and the tax separately", () => {
    const result = calculateInvoice({
      items: [{ quantity: "1", unitPrice: "999.99" }],
      discount: { type: "percentage", value: "12.5" },
      taxRate: "16",
    });
    // 999.99 × 12.5% = 124.99875, which rounds half up to 125.00
    expect(result.discountAmount).toBe("125.00");
    // (999.99 − 125.00) × 16% = 139.9984 → 140.00
    expect(result.taxAmount).toBe("140.00");
    expect(result.total).toBe("1014.99");
  });

  it("allows a discount equal to the subtotal", () => {
    const result = calculateInvoice({
      items: [{ quantity: "1", unitPrice: "100" }],
      discount: { type: "fixed", value: "100" },
    });
    expect(result.total).toBe("0.00");
  });

  it("rejects a fixed discount above the subtotal", () => {
    expect(() =>
      calculateInvoice({
        items: [{ quantity: "1", unitPrice: "100" }],
        discount: { type: "fixed", value: "100.01" },
      }),
    ).toThrow(DiscountExceedsSubtotalError);
  });

  it("returns zero totals for an invoice without items", () => {
    expect(calculateInvoice({ items: [] }).total).toBe("0.00");
  });
});
