import {
  overrideAddedEmail,
  overrideRevokedEmail,
  paymentReceiptEmail,
  proEndedEmail,
} from "./admin-plan-templates.js";

const url = "https://account.billsafi.com/billing";
const to = "user@example.test";

describe("payment receipt template", () => {
  it("names the amount, method, reference and new Pro end", () => {
    const email = paymentReceiptEmail(
      to,
      "Jane",
      {
        purpose: "pro_month",
        months: 3,
        until: new Date("2026-12-28T09:00:00Z"),
        amount: "12.00",
        currency: "USD",
        method: "bank_transfer",
        reference: "REF-<1>",
      },
      url,
    );
    expect(email.subject).toBe("We've recorded your payment of USD 12.00");
    expect(email.text).toContain("bank transfer, reference REF-<1>");
    expect(email.text).toContain("3 months of Pro");
    expect(email.text).toContain("Pro until 28 December 2026.");
    expect(email.html).toContain("REF-&lt;1&gt;");
    expect(email.html).toContain("View billing");
    expect(email.text).toContain(url);
  });

  it("lists the credits for a pack payment and leaves out an unnamed method", () => {
    const email = paymentReceiptEmail(
      to,
      "Jane",
      {
        purpose: "invoice_credits",
        packs: 1,
        credits: 50,
        amount: "520.00",
        currency: "KES",
        method: "other",
        reference: "R1",
      },
      url,
    );
    expect(email.subject).toContain("KES 520.00");
    expect(email.text).toContain("(reference R1)");
    expect(email.text).toContain("50 invoice credits (1 pack)");
    expect(email.text).toContain("don't expire");
  });

  it("says M-Pesa for a direct M-Pesa payment", () => {
    const email = paymentReceiptEmail(
      to,
      "Jane",
      {
        purpose: "invoice_credits",
        packs: 2,
        credits: 100,
        amount: "1040.00",
        currency: "KES",
        method: "mpesa_direct",
        reference: "QWE123",
      },
      url,
    );
    expect(email.text).toContain("M-Pesa, reference QWE123");
  });
});

describe("Pro ended template", () => {
  it("gives the end date and says what stays", () => {
    const email = proEndedEmail(to, "Jane", new Date("2026-12-28T09:00:00Z"), url);
    expect(email.subject).toBe("Your BillSafi Pro plan ends on 28 December 2026");
    expect(email.text).toContain("Free plan");
    expect(email.text).toContain("businesses, invoices and payments");
    expect(email.text).toContain("renew Pro");
    expect(email.text).toContain(url);
  });
});

describe("limit override templates", () => {
  const override = {
    extraInvoices: 5,
    startsAt: new Date("2026-12-01T08:00:00Z"),
    expiresAt: new Date("2027-01-06T08:30:00Z"),
  };

  it("says until when the override is already active", () => {
    const email = overrideAddedEmail(to, "Jane", { ...override, scheduled: false }, url);
    expect(email.subject).toBe("You can issue 5 extra invoices on BillSafi");
    expect(email.text).toContain("until 6 January 2027 at 11:30");
    expect(email.text).not.toContain("from 1 December");
  });

  it("says from and until when it starts later, with the singular", () => {
    const email = overrideAddedEmail(
      to,
      "Jane",
      { ...override, extraInvoices: 1, scheduled: true },
      url,
    );
    expect(email.subject).toBe("You can issue 1 extra invoice on BillSafi");
    expect(email.text).toContain("from 1 December 2026 at 11:00 until 6 January 2027 at 11:30");
  });

  it("says the extra invoices ended", () => {
    const email = overrideRevokedEmail(to, "Jane", url);
    expect(email.subject).toBe("Your extra invoices on BillSafi have ended");
    expect(email.text).toContain("back to what your plan includes");
    expect(email.html).toContain("View billing");
  });
});
