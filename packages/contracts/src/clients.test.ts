import { describe, expect, it } from "vitest";
import { createClientSchema } from "./clients.js";

describe("createClientSchema", () => {
  it("requires name and phone and clears blank optional fields", () => {
    expect(
      createClientSchema.parse({
        name: " Acacia Creative ",
        phone: "0722 111 222",
        email: "",
        companyName: "",
      }),
    ).toMatchObject({
      name: "Acacia Creative",
      phone: "+254722111222",
      email: null,
      companyName: null,
    });
  });

  it("rejects a missing phone and an invalid email", () => {
    expect(createClientSchema.safeParse({ name: "Acacia" }).success).toBe(false);
    expect(
      createClientSchema.safeParse({ name: "Acacia", phone: "0722111222", email: "nope" }).success,
    ).toBe(false);
  });
});
