import { describe, expect, it } from "vitest";
import { roundMoney, toMoneyString } from "./money.js";

describe("roundMoney", () => {
  it("rounds half up to two decimal places", () => {
    expect(toMoneyString("10.125")).toBe("10.13");
    expect(toMoneyString("10.124")).toBe("10.12");
  });

  it("avoids binary floating-point errors", () => {
    expect(roundMoney("0.1").plus("0.2").toFixed(2)).toBe("0.30");
    expect(toMoneyString("1.005")).toBe("1.01");
  });

  it("pads whole amounts for numeric storage", () => {
    expect(toMoneyString("50000")).toBe("50000.00");
  });
});
