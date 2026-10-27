import { keyWords, MAX_CHANGES_BYTES, redact, redactChanges } from "./redact.js";

describe("keyWords", () => {
  it("splits camelCase, snake_case, kebab and acronyms", () => {
    expect(keyWords("clientSecret")).toEqual(["client", "secret"]);
    expect(keyWords("refresh_token")).toEqual(["refresh", "token"]);
    expect(keyWords("X-Api-Key")).toEqual(["x", "api", "key"]);
    expect(keyWords("JWTValue")).toEqual(["jwt", "value"]);
  });
});

describe("redact", () => {
  it("drops secret-named keys at any depth", () => {
    expect(
      redact({
        name: "Wanjiku",
        password: "hunter2",
        nested: {
          accessToken: "a",
          clientSecret: "b",
          apiKey: "c",
          Authorization: "Bearer d",
          cookie: "e",
          MPESA_PASSKEY: "f",
          private_key: "g",
          otp: "1234",
          pin: "0000",
          passwordHash: "h",
          kept: 1,
        },
        list: [{ refresh_token: "f", ok: true }],
      }),
    ).toEqual({ name: "Wanjiku", nested: { kept: 1 }, list: [{ ok: true }] });
  });

  it("keeps keys that only contain a secret word inside another word", () => {
    const value = {
      keyword: "invoice",
      passport: "A123",
      idempotency_key: "k-1",
      tourKey: "dashboard",
      author: "Brian",
      pinned: true,
    };
    expect(redact(value)).toEqual(value);
  });

  it("masks phone numbers by value and by key", () => {
    expect(
      redact({
        contact: "+254712345678",
        local: "0712 345 678",
        phone: "+447946095800",
        msisdn: 254708374149,
      }),
    ).toEqual({
      contact: "+2547•••••678",
      local: "0712•••678",
      phone: "+4479•••••800",
      msisdn: "2547•••••149",
    });
  });

  it("masks under phone keys only values with at least 7 digits", () => {
    expect(redact({ phone: "n/a", phoneCount: 3, mobile: "123456" })).toEqual({
      phone: "n/a",
      phoneCount: 3,
      mobile: "123456",
    });
  });

  it("leaves dates, amounts, IDs and ordinary text alone", () => {
    const value = {
      date: "2026-10-24",
      amount: "1000.00",
      months: 3,
      id: "0196a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      note: "Paid by M-Pesa",
      banned: false,
      empty: null,
    };
    expect(redact(value)).toEqual(value);
  });

  it("uses toJSON and copies rather than mutates", () => {
    const input = {
      at: new Date("2026-10-24T10:00:00.000Z"),
      custom: { toJSON: () => ({ token: "x", shown: 1 }) },
      token: "x",
    };
    expect(redact(input)).toEqual({ at: "2026-10-24T10:00:00.000Z", custom: { shown: 1 } });
    expect(input.token).toBe("x");
  });

  it("stops at eight levels deep", () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let level = 0; level < 10; level++) deep = { next: deep };
    let node = redact(deep) as Record<string, unknown>;
    for (let level = 0; level < 8; level++) node = node.next as Record<string, unknown>;
    expect(node).toBe("[truncated]");
  });

  it("marks cycles instead of looping, but keeps repeated non-cyclic values", () => {
    const shared = { plan: "pro" };
    const cyclic: Record<string, unknown> = { a: shared, b: shared };
    cyclic.self = cyclic;
    expect(redact(cyclic)).toEqual({ a: { plan: "pro" }, b: { plan: "pro" }, self: "[circular]" });
  });
});

describe("redactChanges", () => {
  it("replaces changes over 16 KB with a marker", () => {
    expect(redactChanges({ note: "x".repeat(MAX_CHANGES_BYTES) })).toEqual({ truncated: true });
    expect(redactChanges({ note: "short" })).toEqual({ note: "short" });
  });
});
