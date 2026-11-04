import { reengagementSegments, reengagementSteps } from "@billsafi/contracts";
import { reengagementEmail } from "./reengagement-templates.js";

const base = {
  to: "wanjiku@example.test",
  name: "Wanjiku",
  url: "https://app.example.test/?utm_campaign=x",
  unsubscribeUrl: "https://app.example.test/unsubscribe?token=abc",
  oneClickUrl: "https://app.example.test/api/v1/email-preferences/unsubscribe?token=abc",
  replyTo: "hello@example.test",
  signature: "Brian",
};

describe("check-in emails", () => {
  for (const segment of reengagementSegments) {
    for (const step of reengagementSteps) {
      it(`${segment} step ${step} carries unsubscribe and reply-to`, () => {
        const message = reengagementEmail({ ...base, segment, step });
        expect(message.replyTo).toBe("hello@example.test");
        expect(message.headers).toEqual({
          "List-Unsubscribe": `<${base.oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        });
        expect(message.text).toContain(base.unsubscribeUrl);
        expect(message.text).toContain(base.url);
        expect(message.text).toContain("Hi Wanjiku,");
        if (message.html) expect(message.html).toContain("Unsubscribe from check-in emails");
      });
    }
  }

  it("sends the last step as a plain note signed by a person", () => {
    const message = reengagementEmail({ ...base, segment: "lapsed", step: 3 });
    expect(message.html).toBeUndefined();
    expect(message.text).toContain("reply");
    expect(message.text).toContain("\n\nBrian\n\n");
  });

  it("escapes names in the HTML version", () => {
    const message = reengagementEmail({
      ...base,
      name: "<b>x</b>",
      segment: "no_business",
      step: 1,
    });
    expect(message.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
