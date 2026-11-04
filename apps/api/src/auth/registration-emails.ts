import { inArray, schema, type Database } from "@billsafi/db";
import type { Mailer } from "../mail/mailer.js";
import { registrationAdminEmail, welcomeEmail } from "../mail/templates.js";

/** Called only after a new user is created, for password and Google registrations. */
export function registrationEmails(
  db: Database,
  mailer: Mailer,
  origin: string,
  adminIds: string[],
) {
  return async (user: { id: string; name: string; email: string }) => {
    // Each delivery is independent: a failed welcome must not suppress admin alerts.
    const welcome = mailer.send(welcomeEmail(user.email, user.name, `${origin}/onboarding`), {
      operation: "registration_welcome_email",
      accountId: user.id,
    });
    const admins = async () => {
      if (!adminIds.length) return;
      const recipients = await db
        .select({ email: schema.users.email, name: schema.users.name })
        .from(schema.users)
        .where(inArray(schema.users.id, adminIds));
      await Promise.allSettled(
        recipients.map((recipient) =>
          mailer
            .send(
              registrationAdminEmail(
                recipient.email,
                recipient.name,
                user,
                `${origin}/admin/users/${user.id}`,
              ),
              {
                operation: "registration_admin_email",
                accountId: user.id,
              },
            )
            .catch((error) => {
              console.error("Failed to send registration admin email", error);
            }),
        ),
      );
    };
    const results = await Promise.allSettled([welcome, admins()]);
    for (const result of results) {
      if (result.status === "rejected")
        console.error("Failed to send registration email", result.reason);
    }
  };
}
