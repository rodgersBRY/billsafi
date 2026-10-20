import { describe, expect, it } from "vitest";
import { formatKenyanPhone, normalizeKenyanPhone } from "./phone.js";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0112345678", "+254112345678"],
    ["712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["+254712345678", "+254712345678"],
    ["+254 712 345 678", "+254712345678"],
    ["0712-345-678", "+254712345678"],
    ["(0712) 345678", "+254712345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["0812345678", "landline-style prefix"],
    ["071234567", "too short"],
    ["07123456789", "too long"],
    ["+255712345678", "Tanzanian number"],
    ["07123abc78", "letters"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull();
  });
});

describe("formatKenyanPhone", () => {
  it("formats a stored number for display", () => {
    expect(formatKenyanPhone("+254712345678")).toBe("+254 712 345 678");
  });
});
