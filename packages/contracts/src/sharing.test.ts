import { describe, expect, it } from "vitest";
import { emailDraft, whatsappMessage } from "./sharing.js";

const input = {
  clientName: "Njeri Wambui",
  invoiceNumber: "INV-00001",
  businessName: "Wanjiku Designs",
  balanceDue: "54,810.00",
  dueDate: "30 Oct 2026",
  link: "https://app.example/i/abc",
};

describe("share copy", () => {
  it("builds the adopted WhatsApp message", () => {
    expect(whatsappMessage(input)).toBe(
      "Hi Njeri Wambui, here is invoice INV-00001 from Wanjiku Designs for KES 54,810.00, due 30 Oct 2026: https://app.example/i/abc",
    );
  });

  it("builds the email subject and body", () => {
    const draft = emailDraft(input);
    expect(draft.subject).toBe("Invoice INV-00001 from Wanjiku Designs");
    expect(draft.body.endsWith("The link works for 30 days. Thank you.")).toBe(true);
  });
});
