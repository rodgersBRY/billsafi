import { describe, expect, it } from "vitest";
import { CREDIT_PACK, PRO_PLAN, usdToKes } from "./plans.js";

describe("usdToKes", () => {
  it("rounds up to a whole shilling", () => {
    expect(usdToKes(PRO_PLAN.priceUsd, "129.866552")).toBe("520.00");
    expect(usdToKes(CREDIT_PACK.priceUsd, "129.866552")).toBe("260.00");
  });

  it("keeps an exact conversion unchanged", () => {
    expect(usdToKes("4.00", "130")).toBe("520.00");
  });
});
