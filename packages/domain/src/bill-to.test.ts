import { describe, expect, it } from "vitest";
import { billToLines } from "./bill-to.js";

describe("billToLines", () => {
  it("shows the client name alone when there is no company", () => {
    expect(billToLines("Acacia Creative", null)).toEqual(["Acacia Creative"]);
  });

  it("adds a different company name beneath the client name", () => {
    expect(billToLines("Njeri Wambui", "Kijani Collective")).toEqual([
      "Njeri Wambui",
      "Kijani Collective",
    ]);
  });

  it("does not repeat a company name that matches the client name", () => {
    expect(billToLines("Acacia Creative", "  acacia creative ")).toEqual(["Acacia Creative"]);
  });
});
