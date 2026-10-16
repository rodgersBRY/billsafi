import type { Database } from "@tallynest/db";
import { schema } from "@tallynest/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Env } from "../config/env.js";
import type { Mailer } from "../mail/mailer.js";
import { passwordResetEmail } from "../mail/templates.js";

export const AUTH_BASE_PATH = "/api/v1/auth";

/** Reset links live for one hour and a reset signs out every session (D047). */
const RESET_TOKEN_TTL_SECONDS = 60 * 60;

export interface AuthDependencies {
  db: Database;
  env: Pick<Env, "WEB_ORIGIN" | "BETTER_AUTH_SECRET">;
  mailer: Mailer;
}

export function createAuth({ db, env, mailer }: AuthDependencies) {
  return betterAuth({
    appName: "TallyNest",
    baseURL: env.WEB_ORIGIN,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      // Registration email verification is skipped for V1 (D014).
      requireEmailVerification: false,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Not awaited so response timing does not reveal whether the account exists.
        void mailer.send(passwordResetEmail(user.email, user.name, url)).catch((error) => {
          console.error("Failed to send password reset email", error);
        });
      },
    },
    advanced: {
      database: { generateId: "uuid" },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
