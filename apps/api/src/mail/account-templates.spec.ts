import {
  accountReactivatedEmail,
  accountSuspendedEmail,
  passwordChangedEmail,
  signedOutEverywhereEmail,
} from "./account-templates.js";

const origin = "https://account.billsafi.com";

describe("account security email templates", () => {
  it("tells the owner when the password changed and never includes a password", () => {
    const email = passwordChangedEmail(
      "jane@example.test",
      "Jane",
      new Date("2026-11-06T09:30:00Z"),
      `${origin}/forgot-password`,
      "support@billsafi.com",
    );
    expect(email.subject).toBe("Your BillSafi password was changed");
    expect(email.text).toContain("6 November 2026");
    expect(email.text).toContain(`${origin}/forgot-password`);
    expect(email.text).toContain("support@billsafi.com");
    expect(email.html).toContain("Reset password");
    expect(email.replyTo).toBe("support@billsafi.com");
  });

  it("asks the person to sign in again and does not mention an admin", () => {
    const email = signedOutEverywhereEmail(
      "jane@example.test",
      "Jane",
      `${origin}/sign-in`,
      `${origin}/forgot-password`,
    );
    expect(email.subject).toBe("You've been signed out of BillSafi");
    expect(email.text).toContain(`${origin}/sign-in`);
    expect(email.text).toContain(`${origin}/forgot-password`);
    expect(email.text.toLowerCase()).not.toContain("admin");
  });

  it("says data is kept and links still work, with no reason", () => {
    const email = accountSuspendedEmail(
      "jane@example.test",
      "Jane",
      "support@billsafi.com",
      origin,
    );
    expect(email.subject).toBe("Your BillSafi account is suspended");
    expect(email.text).toContain("has not been deleted");
    expect(email.text).toContain("invoice links");
    expect(email.text).toContain("support@billsafi.com");
    expect(email.replyTo).toBe("support@billsafi.com");
    expect(email.text.toLowerCase()).not.toContain("reason");
  });

  it("sends a reactivated person to sign in", () => {
    const email = accountReactivatedEmail("jane@example.test", "Jane", `${origin}/sign-in`);
    expect(email.subject).toBe("Your BillSafi account is active again");
    expect(email.html).toContain(`href="${origin}/sign-in"`);
  });

  it("uses no em dashes", () => {
    const all = [
      passwordChangedEmail("a@b.test", "J", new Date(), origin, "s@b.test"),
      signedOutEverywhereEmail("a@b.test", "J", origin, origin),
      accountSuspendedEmail("a@b.test", "J", "s@b.test", origin),
      accountReactivatedEmail("a@b.test", "J", origin),
    ];
    for (const email of all) expect(email.text).not.toContain("—");
  });
});
