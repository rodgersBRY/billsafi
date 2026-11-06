import { describe, expect, it } from "vitest";
import { formatDocumentNumber } from "./document-number.js";

describe("formatDocumentNumber", () => {
  it.each([
    ["QT", 1, "QT-00001"],
    ["QT", 4, "QT-00004"],
    ["INV", 100000, "INV-100000"],
  ])("formats %s %i as %s", (prefix, sequence, expected) => {
    expect(formatDocumentNumber(prefix, sequence)).toBe(expected);
  });

  it("rejects non-positive sequences", () => {
    expect(() => formatDocumentNumber("QT", 0)).toThrow(RangeError);
    expect(() => formatDocumentNumber("QT", 1.5)).toThrow(RangeError);
  });
});
