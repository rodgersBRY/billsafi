import { describe, expect, it } from "vitest";
import { balanceDue, isOverdue, nairobiDate, paymentStatus, sumPayments } from "./payments.js";

describe("paymentStatus", () => {
  it("follows Ready, Partially paid, Paid as payments arrive", () => {
    expect(paymentStatus("50000.00", "0.00")).toBe("ready");
    expect(paymentStatus("50000.00", "20000.00")).toBe("partially_paid");
    expect(paymentStatus("50000.00", "50000.00")).toBe("paid");
  });
});

describe("balanceDue", () => {
  it("matches the PRD example: 50,000 with 20,000 recorded leaves 30,000", () => {
    expect(balanceDue("50000.00", "20000.00")).toBe("30000.00");
  });
});

describe("sumPayments", () => {
  it("adds decimal amounts exactly", () => {
    expect(sumPayments(["0.10", "0.20"])).toBe("0.30");
    expect(sumPayments([])).toBe("0.00");
  });
});

describe("nairobiDate", () => {
  it("rolls over at Nairobi midnight, three hours before UTC", () => {
    expect(nairobiDate(new Date("2026-10-30T20:59:59Z"))).toBe("2026-10-30");
    expect(nairobiDate(new Date("2026-10-30T21:00:00Z"))).toBe("2026-10-31");
  });
});

describe("isOverdue", () => {
  const due = "2026-10-30";

  it("is not overdue on the due date itself", () => {
    expect(isOverdue("ready", due, new Date("2026-10-30T20:59:59Z"))).toBe(false);
  });

  it("is overdue from 00:00 Nairobi the next day", () => {
    expect(isOverdue("ready", due, new Date("2026-10-30T21:00:00Z"))).toBe(true);
    expect(isOverdue("partially_paid", due, new Date("2026-11-02T08:00:00Z"))).toBe(true);
  });

  it("never applies to drafts, paid or cancelled invoices", () => {
    const later = new Date("2026-12-01T00:00:00Z");
    for (const status of ["draft", "paid", "cancelled"]) {
      expect(isOverdue(status, due, later)).toBe(false);
    }
  });
});
