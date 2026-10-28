import { describe, expect, it } from "vitest";
import { invoiceDetailsSchema, saveInvoiceSchema } from "./invoices.js";

const base = {
  clientId: "01a143e6-3893-73c6-b4ce-24527eebbf2b",
  issueDate: "2026-10-16",
  dueDate: "2026-10-30",
  items: [{ description: "Logo design", quantity: "1", unitPrice: "15000" }],
};

describe("saveInvoiceSchema", () => {
  it("accepts optional custom invoice numbers and trims them", () => {
    expect(
      saveInvoiceSchema.parse({ ...base, invoiceNumber: "  ACME/2026-001  " }).invoiceNumber,
    ).toBe("ACME/2026-001");
    for (const invoiceNumber of [undefined, null, ""]) {
      expect(saveInvoiceSchema.safeParse({ ...base, invoiceNumber }).success).toBe(true);
    }
  });

  it.each(["x".repeat(81), "INV\n001", 'INV"001', "INV\\001"])(
    "rejects unsupported invoice number %s",
    (invoiceNumber) => {
      expect(saveInvoiceSchema.safeParse({ ...base, invoiceNumber }).success).toBe(false);
    },
  );

  it("accepts a valid draft and defaults optional pricing to off", () => {
    expect(saveInvoiceSchema.parse(base)).toMatchObject({ discount: null, taxRate: null });
  });

  it("keeps amounts as strings and accepts numbers from forms", () => {
    const parsed = saveInvoiceSchema.parse({
      ...base,
      items: [{ description: "Hours", quantity: 1.5, unitPrice: "2500.50" }],
    });
    expect(parsed.items[0]).toMatchObject({ quantity: "1.5", unitPrice: "2500.50" });
  });

  it.each([
    ["three decimal places", { quantity: "1.125" }],
    ["zero quantity", { quantity: "0" }],
    ["huge quantity", { quantity: "1000001" }],
    ["unit price over the limit", { unitPrice: "100000000.01" }],
    ["negative unit price", { unitPrice: "-5" }],
  ])("rejects %s", (_, override) => {
    const result = saveInvoiceSchema.safeParse({
      ...base,
      items: [{ ...base.items[0], ...override }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = saveInvoiceSchema.safeParse({ ...base, dueDate: "2026-10-01" });
    expect(result.error?.issues[0]?.path).toEqual(["dueDate"]);
  });

  it("caps percentage discounts and tax at 100", () => {
    expect(
      saveInvoiceSchema.safeParse({ ...base, discount: { type: "percentage", value: "101" } })
        .success,
    ).toBe(false);
    expect(saveInvoiceSchema.safeParse({ ...base, taxRate: "100.5" }).success).toBe(false);
  });

  it("limits line items to 100", () => {
    const items = Array.from({ length: 101 }, () => base.items[0]);
    expect(saveInvoiceSchema.safeParse({ ...base, items }).success).toBe(false);
  });
});

describe("invoiceDetailsSchema", () => {
  const { clientId: _clientId, ...details } = base;

  it("accepts details without a client and defaults optional pricing to off", () => {
    expect(invoiceDetailsSchema.parse(details)).toMatchObject({ discount: null, taxRate: null });
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceDetailsSchema.safeParse({ ...details, dueDate: "2026-10-01" });
    expect(result.error?.issues[0]?.path).toEqual(["dueDate"]);
  });
});

describe("decimal fields", () => {
  it("says a blank amount is required rather than malformed", () => {
    const result = saveInvoiceSchema.safeParse({
      clientId: "01a143e6-3893-73c6-b4ce-24527eebbf2b",
      issueDate: "2026-10-16",
      dueDate: "2026-10-30",
      items: [{ description: "Logo", quantity: "1", unitPrice: "" }],
    });
    expect(result.error?.issues[0]?.message).toBe("Unit price is required");
  });
});
