// Creates (or resets) the admin account the browser tests sign in with. Idempotent.
// The ID is fixed so CI can list it in ADMIN_USER_IDS before the API starts; the API's
// start-up role sync then makes it an admin. The password is hashed with Better Auth's
// own function, so it signs in like any email account.
import { createDatabase, sql } from "@billsafi/db";
import { hashPassword } from "better-auth/crypto";

const BROWSER_ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";

const url = process.env.DATABASE_URL;
const email = process.env.E2E_ADMIN_EMAIL ?? "admin-e2e@example.test";
const password = process.env.E2E_ADMIN_PASSWORD;
if (!url || !password) {
  console.error("Set DATABASE_URL and E2E_ADMIN_PASSWORD.");
  process.exit(1);
}

const { db, pool } = createDatabase(url);
try {
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into users (id, name, email, email_verified)
      values (${BROWSER_ADMIN_ID}, 'Browser Test Admin', ${email}, true)
      on conflict (id) do update
        set email = excluded.email, banned = false, ban_reason = null, ban_expires = null
    `);
    await tx.execute(sql`
      delete from accounts where user_id = ${BROWSER_ADMIN_ID} and provider_id = 'credential'
    `);
    await tx.execute(sql`
      insert into accounts (account_id, provider_id, user_id, password, updated_at)
      values (${BROWSER_ADMIN_ID}, 'credential', ${BROWSER_ADMIN_ID}, ${hash}, now())
    `);
  });
  console.log(`Browser test admin ready: ${email} (${BROWSER_ADMIN_ID})`);
} finally {
  await pool.end();
}
