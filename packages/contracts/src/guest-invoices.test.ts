import { describe, expect, it } from "vitest";
import { importGuestInvoiceSchema } from "./guest-invoices.js";

const draft = {
  business: {
    profileType: "individual",
    displayName: "Amani Njeri",
    contactEmail: "amani@example.test",
    phone: "0712 345 678",
  },
  client: { name: "Karibu Coffee", phone: "0722 111 222" },
  invoice: {
    issueDate: "2026-10-16",
    dueDate: "2026-10-30",
    items: [{ description: "Logo design", quantity: "1", unitPrice: "15000" }],
  },
};

const firstPath = (input: unknown) =>
  importGuestInvoiceSchema.safeParse(input).error?.issues[0]?.path;

describe("importGuestInvoiceSchema", () => {
  it("accepts a full draft and normalises phone numbers", () => {
    const parsed = importGuestInvoiceSchema.parse(draft);
    expect(parsed.business.phone).toBe("+254712345678");
    expect(parsed.client.phone).toBe("+254722111222");
  });

  it("rejects a missing client phone", () => {
    expect(firstPath({ ...draft, client: { name: "Karibu Coffee" } })).toEqual(["client", "phone"]);
  });

  it("rejects a bad business email", () => {
    const business = { ...draft.business, contactEmail: "not-an-email" };
    expect(firstPath({ ...draft, business })).toEqual(["business", "contactEmail"]);
  });

  it("rejects an invoice with no line items", () => {
    expect(firstPath({ ...draft, invoice: { ...draft.invoice, items: [] } })).toEqual([
      "invoice",
      "items",
    ]);
  });

  it("rejects a due date before the issue date", () => {
    const invoice = { ...draft.invoice, dueDate: "2026-10-01" };
    expect(firstPath({ ...draft, invoice })).toEqual(["invoice", "dueDate"]);
  });
});
