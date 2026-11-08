import { describe, expect, it } from "vitest";
import { createSavedItemSchema } from "./items.js";

describe("createSavedItemSchema", () => {
  it("trims the description and defaults the quantity to 1", () => {
    expect(createSavedItemSchema.parse({ description: " Logo design ", unitPrice: 15000 })).toEqual(
      { description: "Logo design", quantity: "1", unitPrice: "15000" },
    );
  });

  it("rejects what an invoice line would reject", () => {
    expect(createSavedItemSchema.safeParse({ description: "", unitPrice: "10" }).success).toBe(
      false,
    );
    expect(
      createSavedItemSchema.safeParse({ description: "Hosting", unitPrice: "10.555" }).success,
    ).toBe(false);
    expect(
      createSavedItemSchema.safeParse({ description: "Hosting", quantity: "0", unitPrice: "10" })
        .success,
    ).toBe(false);
  });
});
