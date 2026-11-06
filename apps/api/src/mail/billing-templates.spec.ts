import { paymentFailedEmail, paymentReceiptEmail } from "./billing-templates.js";

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
});
