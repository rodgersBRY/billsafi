import { describe, expect, it } from "vitest";
import {
  canAddBusiness,
  canAddSavedItem,
  CREDIT_PACK,
  FREE_PLAN,
  newlyUsedSavedItems,
  PRO_PLAN,
  usdToKes,
} from "./plans.js";

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

describe("canAddBusiness", () => {
  it("lets a Free account create its first business only", () => {
    expect(FREE_PLAN.businessLimit).toBe(1);
    expect(canAddBusiness(false, 0)).toBe(true);
    expect(canAddBusiness(false, 1)).toBe(false);
  });

  it("blocks Free accounts that are already over the cap", () => {
    expect(canAddBusiness(false, 3)).toBe(false);
  });

  it("lets Pro accounts add any number", () => {
    expect(canAddBusiness(true, 1)).toBe(true);
    expect(canAddBusiness(true, 50)).toBe(true);
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
