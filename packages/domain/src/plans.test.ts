import { describe, expect, it } from "vitest";
import { canAddSavedItem, CREDIT_PACK, newlyUsedSavedItems, PRO_PLAN, usdToKes } from "./plans.js";

describe("usdToKes", () => {
  it("rounds up to a whole shilling", () => {
    expect(usdToKes(PRO_PLAN.priceUsd, "129.866552")).toBe("520.00");
    expect(usdToKes(CREDIT_PACK.priceUsd, "129.866552")).toBe("260.00");
  });

  it("keeps an exact conversion unchanged", () => {
    expect(usdToKes("4.00", "130")).toBe("520.00");
  });
});

describe("canAddSavedItem", () => {
  it("caps Free accounts at 5 active saved items", () => {
    expect(canAddSavedItem(false, 4)).toBe(true);
    expect(canAddSavedItem(false, 5)).toBe(false);
  });

  it("lets Pro accounts add any number", () => {
    expect(canAddSavedItem(true, 500)).toBe(true);
  });
});

describe("newlyUsedSavedItems", () => {
  it("returns each newly linked saved item once", () => {
    expect(newlyUsedSavedItems(["a", null], ["a", "b", "b", null, undefined, "c"])).toEqual([
      "b",
      "c",
    ]);
  });

  it("returns nothing when the links are unchanged", () => {
    expect(newlyUsedSavedItems(["a", "b"], ["b", "a"])).toEqual([]);
  });
});
