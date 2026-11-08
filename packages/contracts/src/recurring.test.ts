import { describe, expect, it } from "vitest";
import { saveRecurringInvoiceSchema } from "./recurring.js";

const valid = {
  clientId: "0195f7a2-1c3d-7e4f-8a9b-0c1d2e3f4a5b",
  frequency: "monthly",
  mode: "draft",
  startDate: "2026-12-01",
  paymentTermsDays: 14,
  items: [{ description: "Retainer for {month}", quantity: "1", unitPrice: "20000" }],
};

describe("saveRecurringInvoiceSchema", () => {
  it("defaults to no end", () => {
    expect(saveRecurringInvoiceSchema.parse(valid)).toMatchObject({
      endDate: null,
      maxCount: null,
      discount: null,
      taxRate: null,
    });
  });

  it("needs a line item", () => {
    const result = saveRecurringInvoiceSchema.safeParse({ ...valid, items: [] });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["items"],
      message: "Add at least one line item",
    });
  });

  it("takes an end date or a count, not both", () => {
    const result = saveRecurringInvoiceSchema.safeParse({
      ...valid,
      endDate: "2027-06-01",
      maxCount: 3,
    });
    expect(result.error?.issues[0]?.path).toEqual(["maxCount"]);
  });

  it("rejects an end before the start", () => {
    const result = saveRecurringInvoiceSchema.safeParse({ ...valid, endDate: "2026-11-01" });
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });
});
