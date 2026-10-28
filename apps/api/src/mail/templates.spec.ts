import { passwordResetEmail, renewalReminderEmail } from "./templates.js";

describe("transactional email templates", () => {
  it("escapes user content and reset link query parameters in HTML", () => {
    const email = passwordResetEmail(
      "user@example.test",
      '<img src=x onerror="alert(1)">',
      "https://account.billsafi.com/reset-password?token=test&next=home",
      900,
    );
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("token=test&amp;next=home");
    expect(email.html).toContain("900 seconds");
    expect(email.text).toContain("900 seconds");
    expect(email.text).toContain("token=test&next=home");
  });

  it("rejects non-web action links", () => {
    expect(() => passwordResetEmail("user@example.test", "Jane", "javascript:alert(1)")).toThrow(
      "Email links must use HTTP or HTTPS",
    );
  });

  it.each(["before_expiry", "on_expiry"] as const)(
    "renders the %s reminder in HTML and text",
    (kind) => {
      const email = renewalReminderEmail(
        "user@example.test",
        "Jane",
        new Date("2026-10-28T09:00:00Z"),
        "https://account.billsafi.com/billing",
        kind,
      );
      expect(email.html).toContain("Renew Pro");
      expect(email.html).toContain("28 October 2026");
      expect(email.html).toContain("Free plan");
      expect(email.text).toContain("https://account.billsafi.com/billing");
      expect(email.subject).toContain(kind === "on_expiry" ? "today" : "soon");
    },
  );
});
