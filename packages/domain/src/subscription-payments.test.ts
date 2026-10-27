import { describe, expect, it } from "vitest";
import { stuckPaymentCutoff } from "./subscription-payments.js";

describe("stuckPaymentCutoff", () => {
  it("is ten minutes before the given time", () => {
    expect(stuckPaymentCutoff(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe(
      "2026-10-24T09:50:00.000Z",
    );
  });
});
