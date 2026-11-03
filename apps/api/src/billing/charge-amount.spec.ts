import { describe, expect, it } from "vitest";
import { checkoutChargeKes } from "./charge-amount.js";

describe("checkoutChargeKes", () => {
  it("charges KES 1 in the Daraja sandbox", () => {
    expect(checkoutChargeKes("sandbox", "4", "129.87")).toBe("1.00");
  });

  it("charges the converted price in production", () => {
    expect(checkoutChargeKes("production", "4", "129.87")).toBe("520.00");
  });

  it("charges the converted price with the fake provider", () => {
    expect(checkoutChargeKes("fake", "2", "129.87")).toBe("260.00");
  });
});
