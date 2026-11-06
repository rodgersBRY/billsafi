import {
  freeLimitEmail,
  paymentFailedEmail,
  paymentReceiptEmail,
  proEndedEmail,
} from "./billing-templates.js";

const URL = "https://account.billsafi.com/billing";

describe("billing email templates", () => {
  it("writes a Pro receipt with the amount, receipt code and new end date", () => {
    const email = paymentReceiptEmail(
      "jane@example.test",
      "Jane",
      {
        purchase: { kind: "pro_month", until: new Date("2026-12-06T09:00:00Z") },
        amount: "500.00",
        currency: "KES",
        receipt: "TK12AB34CD",
      },
      URL,
    );
    expect(email.subject).toBe("Payment received: 1 month of Pro");
    expect(email.text).toContain("KES 500.00");
    expect(email.text).toContain("TK12AB34CD");
    expect(email.text).toContain("Pro until 6 December 2026");
    expect(email.html).toContain(`href="${URL}"`);
  });

  it("writes a credits receipt and leaves out a missing receipt code", () => {
    const email = paymentReceiptEmail(
      "jane@example.test",
      "Jane",
      {
        purchase: { kind: "invoice_credits", credits: 50 },
        amount: "250.00",
        currency: "KES",
        receipt: null,
      },
      URL,
    );
    expect(email.subject).toBe("Payment received: 50 invoice credits");
    expect(email.text).toContain("50 credits added");
    expect(email.text).not.toContain("M-Pesa receipt");
  });

  it("tells the person a failed payment charged nothing and links to Billing", () => {
    const email = paymentFailedEmail("jane@example.test", "Jane", URL);
    expect(email.subject).toBe("Your BillSafi payment didn't go through");
    expect(email.text).toContain("you haven't been charged");
    expect(email.text).toContain(URL);
    expect(email.text).not.toContain("—");
  });

  it("tells the person Pro has ended and that their work is still there", () => {
    const email = proEndedEmail("jane@example.test", "Jane", URL);
    expect(email.subject).toBe("Your BillSafi Pro has ended");
    expect(email.text).toContain("Free plan");
    expect(email.text).toContain("businesses, invoices and payment records are all still there");
    expect(email.html).toContain(`href="${URL}"`);
  });

  it("names the Free limit, the reset date and both ways to carry on", () => {
    const email = freeLimitEmail(
      "jane@example.test",
      "Jane",
      10,
      new Date("2026-11-30T21:00:00Z"),
      URL,
    );
    expect(email.text).toContain("all 10 invoices");
    expect(email.text).toContain("resets on 1 December 2026");
    expect(email.text).toContain("upgrade to Pro or buy invoice credits");
    expect(email.text).not.toContain("—");
  });
});
