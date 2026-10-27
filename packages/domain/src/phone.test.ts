import { describe, expect, it } from "vitest";
import {
  editablePhone,
  formatKenyanPhone,
  formatPhone,
  maskPhone,
  normalizeKenyanPhone,
  normalizePhone,
} from "./phone.js";

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

describe("normalizePhone", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["+254 712 345 678", "+254712345678"],
    ["+44 20 7946 0958", "+442079460958"],
    ["0044 20 7946 0958", "+442079460958"],
    ["+1 (555) 010-0000", "+15550100000"],
    ["+234 803 123 4567", "+2348031234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["020 7946 0958", "local number without a country code"],
    ["+0 123 456 789", "country code starting with 0"],
    ["+1234567", "too short"],
    ["+1234567890123456", "too long"],
    ["+44 20 abc 0958", "letters"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups Kenyan mobiles", () => {
    expect(formatPhone("+254712345678")).toBe("+254 712 345 678");
  });

  it("shows other numbers as stored", () => {
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});

describe("editablePhone", () => {
  it("shows Kenyan mobiles in local form", () => {
    expect(editablePhone("+254712345678")).toBe("0712 345 678");
  });

  it("keeps other numbers as stored", () => {
    expect(editablePhone("+442079460958")).toBe("+442079460958");
  });
});

describe("maskPhone", () => {
  it("keeps the country code, first digit and last three digits", () => {
    expect(maskPhone("+254712345678")).toBe("+2547•••••678");
  });

  it("masks international numbers the same way", () => {
    expect(maskPhone("+447946095800")).toBe("+4479•••••800");
  });

  it("still hides digits in very short values", () => {
    expect(maskPhone("1234567")).toBe("••••567");
  });
});
