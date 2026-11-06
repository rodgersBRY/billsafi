import { Logger } from "@nestjs/common";
import { type Database, eq, schema } from "@billsafi/db";
import { readSetting } from "../platform/platform-settings.js";
import type { MailMessage, Mailer } from "./mailer.js";

const logger = new Logger("AccountEmail");

/**
 * Emails an account after an admin action has committed. A failed send is logged and
 * never undoes the action. Banned accounts are included on purpose.
 */
export async function emailAccount(
  db: Database,
  mailer: Mailer,
  userId: string,
  operation: string,
  compose: (user: { email: string; name: string }, supportEmail: string) => MailMessage,
): Promise<void> {
  try {
    const [user] = await db
      .select({ email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!user) return;
    const support = await readSetting(db, "support_contact");
    await mailer.send(compose(user, support.email), { operation, accountId: userId });
  } catch (error) {
    logger.warn(`${operation} for account ${userId} failed: ${String(error)}`);
  }
}
