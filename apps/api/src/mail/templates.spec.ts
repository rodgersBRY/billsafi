import {
  passwordResetEmail,
  renewalReminderEmail,
  welcomeEmail,
  registrationAdminEmail,
} from "./templates.js";

describe("transactional email templates", () => {
  it("escapes user content and reset link query parameters in HTML", () => {
    const email = passwordResetEmail(
      "user@example.test",
      '<img src=x onerror="alert(1)">',
      "https://account.billsafi.com/reset-password?token=test&next=home",
      900,
    );
    // The only image is the logo; the injected one is escaped.
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("token=test&amp;next=home");
    expect(email.html).toContain("900 seconds");
    expect(email.text).toContain("900 seconds");
    expect(email.text).toContain("token=test&next=home");
  });

  it("shows the logo from the same origin as the button", () => {
    const email = welcomeEmail(
      "user@example.test",
      "Jane",
      "https://account.billsafi.com/onboarding",
    );
    expect(email.html).toContain('src="https://account.billsafi.com/brand/logo-mark.png"');
    expect(email.subject).toBe("Welcome to BillSafi");
    expect(email.text).toContain("10 invoices a month");
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

describe("registration templates", () => {
  it("escapes names and emails while retaining plain-text content", () => {
    const user = { id: "user-id", name: "<script>bad</script>", email: "<user>@example.test" };
    for (const message of [
      welcomeEmail(user.email, user.name, "https://account.billsafi.com/onboarding"),
      registrationAdminEmail(
        "admin@example.test",
        user.name,
        user,
        "https://account.billsafi.com/admin/users",
      ),
    ]) {
      expect(message.html).not.toContain("<script>");
      expect(message.html).toContain("&lt;script&gt;");
      expect(message.text).toContain(user.name);
    }
  });
});
