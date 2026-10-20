// Entry point for `pnpm auth:generate` only. The Better Auth CLI reads the
// exported `auth` to produce the Drizzle schema in packages/db.
import { createDatabase } from "@billsafi/db";
import { createAuth } from "./auth.js";

export const auth = createAuth({
  db: createDatabase("postgres://localhost/schema-generation-only").db,
  env: {
    WEB_ORIGIN: "http://localhost:3000",
    BETTER_AUTH_SECRET: "x".repeat(32),
    RESET_TOKEN_TTL_SECONDS: 3600,
  },
  mailer: { send: async () => {} },
});
