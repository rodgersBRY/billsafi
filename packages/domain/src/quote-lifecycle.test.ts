import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  isQuoteExpired,
  quoteAllows,
  quoteContentChanged,
  type QuoteContent,
  quoteDisplayStatus,
} from "./quote-lifecycle.js";

// 23:59 on 19 Nov in Nairobi is 20:59 UTC; 00:00 on 20 Nov is 21:00 UTC on the 19th.
const lastMinute = new Date("2026-11-19T20:59:00Z");
const nextDay = new Date("2026-11-19T21:00:00Z");

describe("quote expiry", () => {
  it("keeps a sent quote valid through its valid-until day in Nairobi", () => {
    expect(isQuoteExpired("sent", "2026-11-19", lastMinute)).toBe(false);
    expect(isQuoteExpired("sent", "2026-11-19", nextDay)).toBe(true);
  });

  it("never expires quotes that are not sent", () => {
    for (const status of ["draft", "accepted", "declined", "withdrawn", "converted"] as const) {
      expect(isQuoteExpired(status, "2026-01-01", nextDay)).toBe(false);
    }
  });

  it("shows expired as its own display status", () => {
    expect(quoteDisplayStatus("sent", "2026-11-19", nextDay)).toBe("expired");
    expect(quoteDisplayStatus("sent", "2026-11-19", lastMinute)).toBe("sent");
    expect(quoteDisplayStatus("accepted", "2026-11-19", nextDay)).toBe("accepted");
  });
});

describe("quoteAllows", () => {
  const table = {
    edit: ["draft", "sent", "declined", "expired"],
    send: ["draft", "declined", "expired"],
    share: ["sent"],
    withdraw: ["sent", "declined", "expired"],
    delete: ["draft"],
    respond: ["sent"],
    convert: ["accepted", "sent"],
  } as const;
  const all = [
    "draft",
    "sent",
    "expired",
    "accepted",
    "declined",
    "withdrawn",
    "converted",
  ] as const;

  for (const [action, allowed] of Object.entries(table)) {
    for (const status of all) {
      const expected = (allowed as readonly string[]).includes(status);
      it(`${expected ? "allows" : "blocks"} ${action} on ${status}`, () => {
        expect(quoteAllows(action as keyof typeof table, status)).toBe(expected);
      });
    }
  }
});

describe("quoteContentChanged", () => {
  const base: QuoteContent = {
    currency: "KES",
    validUntil: "2026-11-19",
    discount: { type: "percentage", value: "10" },
    taxRate: null,
    notes: "50% deposit first",
    items: [{ description: "Logo", quantity: "1", unitPrice: "15000" }],
  };

  it("ignores number formatting differences between input and stored values", () => {
    const stored: QuoteContent = {
      ...base,
      discount: { type: "percentage", value: "10.00" },
      items: [{ description: "Logo", quantity: "1.00", unitPrice: "15000.00" }],
    };
    expect(quoteContentChanged(base, stored)).toBe(false);
  });

  it.each([
    ["price", { items: [{ description: "Logo", quantity: "1", unitPrice: "16000" }] }],
    ["validity", { validUntil: "2026-11-30" }],
    ["notes", { notes: null }],
    ["tax", { taxRate: "16" }],
    ["discount", { discount: null }],
    ["item order", { items: [...base.items, { description: "Menu", quantity: "1", unitPrice: "8000" }] }],
  ])("detects a %s change", (_label, change) => {
    expect(quoteContentChanged(base, { ...base, ...change })).toBe(true);
  });
});

describe("addCalendarDays", () => {
  it("adds days across month ends", () => {
    expect(addCalendarDays("2026-11-20", 14)).toBe("2026-12-04");
    expect(addCalendarDays("2026-12-25", 7)).toBe("2027-01-01");
  });
});
