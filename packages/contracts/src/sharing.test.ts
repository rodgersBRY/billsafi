import { describe, expect, it } from "vitest";
import { emailDraft, quoteEmailDraft, quoteWhatsappMessage, whatsappMessage } from "./sharing.js";

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

describe("quote share text", () => {
  const input = {
    clientName: "Otieno",
    quoteNumber: "QT-00004",
    businessName: "Wanjiku Designs",
    total: "20,700.00",
    validUntil: "19 Nov 2026",
    link: "https://app.example/q/abc",
  };
  it("builds the WhatsApp message and email draft", () => {
    expect(quoteWhatsappMessage(input)).toBe(
      "Hi Otieno, here is quote QT-00004 from Wanjiku Designs for KES 20,700.00, valid until 19 Nov 2026: https://app.example/q/abc",
    );
    expect(quoteEmailDraft(input).subject).toBe("Quote QT-00004 from Wanjiku Designs");
    expect(quoteEmailDraft(input).body).toContain("You can accept or decline it on the page.");
  });
});
