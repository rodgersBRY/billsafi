// One-off (D078): emails accounts about gifts given before gift emails existed.
// Lists who would get an email; add --send to send. Safe to run again.
//   docker compose exec api node apps/api/dist/cli/notify-past-gifts.js [--send]
import "reflect-metadata";
import { createDatabase } from "@billsafi/db";
import { findPastGifts, sendPastGifts } from "../admin/subscriptions/past-gifts.js";
import { AllowanceService } from "../billing/allowance.service.js";
import { loadEnv } from "../config/env.js";
import { createMailer } from "../mail/mail.module.js";

const send = process.argv.includes("--send");
const env = loadEnv();
const connection = createDatabase(env.DATABASE_URL);
const mailer = createMailer(env);
const allowance = new AllowanceService(connection, mailer, env);

try {
  const recipients = await findPastGifts(connection.db, allowance, new Date());
  for (const { email, gifts } of recipients) {
    const parts = [
      gifts.pro && `${gifts.pro.months} Pro month(s) until ${gifts.pro.until.toISOString()}`,
      gifts.credits && `${gifts.credits.given} credit(s) given, ${gifts.credits.left} left`,
    ].filter(Boolean);
    console.log(`${email}: ${parts.join("; ")}`);
  }
  if (!send) {
    console.log(`${recipients.length} account(s) would be emailed. Run again with --send to send.`);
  } else {
    const result = await sendPastGifts(
      connection.db,
      mailer,
      `${env.WEB_ORIGIN}/billing`,
      recipients,
    );
    console.log(`Sent ${result.sent} of ${recipients.length}.`);
    if (result.failed.length) {
      console.log(`Failed for account(s): ${result.failed.join(", ")}. Run again to retry them.`);
      process.exitCode = 1;
    }
  }
} finally {
  await connection.pool.end();
}
