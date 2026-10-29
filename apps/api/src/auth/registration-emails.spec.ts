import type { Database } from "@billsafi/db";
import { vi } from "vitest";
import { registrationEmails } from "./registration-emails.js";

const user = { id: "new-user", name: "Wanjiku", email: "wanjiku@example.test" };
function setup(admins: { name: string; email: string }[] = []) {
  const where = vi.fn().mockResolvedValue(admins);
  const db = { select: vi.fn(() => ({ from: () => ({ where }) })) };
  const mailer = { send: vi.fn().mockResolvedValue(undefined) };
  return { db: db as unknown as Database, mailer, where };
}

describe("registration emails", () => {
  it("welcomes the new user and privately alerts each configured admin", async () => {
    const { db, mailer } = setup([
      { name: "Admin", email: "admin@example.test" },
      { name: "Other admin", email: "other@example.test" },
    ]);
    await registrationEmails(db, mailer, "https://account.billsafi.com", ["admin", "other"])(user);
    expect(mailer.send).toHaveBeenCalledTimes(3);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: expect.stringContaining("Welcome"),
        text: expect.stringContaining("/onboarding"),
      }),
      { operation: "registration_welcome_email", accountId: user.id },
    );
    for (const email of ["admin@example.test", "other@example.test"]) {
      expect(mailer.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: email, text: expect.stringContaining(user.email) }),
        { operation: "registration_admin_email", accountId: user.id },
      );
    }
  });

  it("still welcomes users when no admins are configured", async () => {
    const { db, mailer, where } = setup();
    await registrationEmails(db, mailer, "https://account.billsafi.com", [])(user);
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(where).not.toHaveBeenCalled();
  });

  it("does not fail registration or suppress other recipients when delivery fails", async () => {
    const { db, mailer } = setup([{ name: "Admin", email: "admin@example.test" }]);
    mailer.send.mockRejectedValueOnce(new Error("delivery failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        registrationEmails(db, mailer, "https://account.billsafi.com", ["admin"])(user),
      ).resolves.toBeUndefined();
      expect(mailer.send).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
