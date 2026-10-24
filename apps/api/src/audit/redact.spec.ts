import { redact } from "./redact.js";

describe("redact", () => {
  it("drops secret-looking keys at any depth", () => {
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
          kept: 1,
        },
        list: [{ refresh_token: "f", ok: true }],
      }),
    ).toEqual({ name: "Wanjiku", nested: { kept: 1 }, list: [{ ok: true }] });
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

  it("turns dates into ISO strings and copies rather than mutates", () => {
    const input = { at: new Date("2026-10-24T10:00:00.000Z"), token: "x" };
    expect(redact(input)).toEqual({ at: "2026-10-24T10:00:00.000Z" });
    expect(input.token).toBe("x");
  });
});
