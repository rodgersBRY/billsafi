import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "./invoice-number.js";

describe("formatInvoiceNumber", () => {
  it.each([
    [1, "INV-00001"],
    [42, "INV-00042"],
    [99999, "INV-99999"],
    [100000, "INV-100000"],
  ])("formats %i as %s", (sequence, expected) => {
    expect(formatInvoiceNumber(sequence)).toBe(expected);
  });

  it("rejects non-positive sequences", () => {
    expect(() => formatInvoiceNumber(0)).toThrow(RangeError);
  });
});
