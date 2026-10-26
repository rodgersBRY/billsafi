import { REGISTRATION_CLOSED_CODE } from "@billsafi/contracts";
import type { Database } from "@billsafi/db";
import { schema } from "@billsafi/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { defaultAc } from "better-auth/plugins/admin/access";
import type { Env } from "../config/env.js";
import type { Mailer } from "../mail/mailer.js";
import { passwordResetEmail } from "../mail/templates.js";
import { readSetting } from "../platform/platform-settings.js";

export const AUTH_BASE_PATH = "/api/v1/auth";

/** Reset links live for one hour and a reset signs out every session (D047). */
export interface AuthDependencies {
  db: Database;
  env: Pick<
    Env,
    | "WEB_ORIGIN"
    | "BETTER_AUTH_SECRET"
    | "RESET_TOKEN_TTL_SECONDS"
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
  >;
  mailer: Mailer;
}

const PROVIDER_TOKEN_FIELDS = [
  "accessToken",
  "refreshToken",
  "idToken",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
] as const;

/**
 * Google tokens are only needed during the sign-in round trip; BillSafi never calls Google
 * APIs, so they are not kept. Password rows never carry these fields and pass through.
 */
async function dropProviderTokens<T extends Record<string, unknown>>(account: T) {
  if (!PROVIDER_TOKEN_FIELDS.some((field) => field in account)) return;
  const cleared = Object.fromEntries(PROVIDER_TOKEN_FIELDS.map((field) => [field, null]));
  return { data: { ...account, ...cleared } };
}

/**
 * Platform roles and suspension (bans) come from Better Auth's admin plugin. Its ban check
 * runs whenever a session is created, so it covers email and Google sign-in alike.
 * The admin role is granted only by the ADMIN_USER_IDS sync, never over HTTP.
 */
const createAdminPlugin = () =>
  admin({
    defaultRole: "user",
    adminRoles: ["admin"],
    // Narrower than the plugin default: no impersonation, role changes, deletes or passwords,
    // so even a direct server call to those functions is refused.
    roles: {
      admin: defaultAc.newRole({ user: ["list", "get", "ban"], session: ["list", "revoke"] }),
      user: defaultAc.newRole({ user: [], session: [] }),
    },
    bannedUserMessage: "This account is suspended. Contact support if you think this is a mistake.",
  });

/**
 * Every admin plugin endpoint is switched off over HTTP; the Nest admin module does these
 * jobs behind its own guard and audit log. Derived from the plugin so an upgrade that adds
 * an endpoint is covered too (the e2e suite also checks the known list).
 */
export const DISABLED_ADMIN_PATHS = Object.values(createAdminPlugin().endpoints).map(
  (endpoint) => endpoint.path,
);

/**
 * get-session answers null for a suspended account. Suspending deletes its sessions, but if
 * one survived (a failed delete, a row made some other way) the web app must still treat
 * the visitor as signed out. Nest's SessionGuard applies the same rule to API routes.
 */
export const hideBannedSessions = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/get-session") return;
  const returned = ctx.context.returned as { user?: { banned?: boolean | null } } | null;
  if (returned && typeof returned === "object" && returned.user?.banned) return ctx.json(null);
});

/**
 * Better Auth answers an APIError from this hook with a 403 {code, message} for email
 * sign-up, and redirects Google sign-in to the sign-in page with ?error=<code>&error_description=<message>.
 */
export function refuseWhenRegistrationClosed(db: Database) {
  return async () => {
    const registration = await readSetting(db, "registration");
    if (registration.open) return;
    throw new APIError("FORBIDDEN", {
      code: REGISTRATION_CLOSED_CODE,
      message: registration.closedMessage,
    });
  };
}

/** Sign-in methods the web app should offer besides email and password. */
export function enabledSocialProviders(env: AuthDependencies["env"]) {
  return { google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) };
}

export function createAuth({ db, env, mailer }: AuthDependencies) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          // Lets people with several Google accounts pick the right one.
          prompt: "select_account" as const,
        }
      : undefined;

  return betterAuth({
    appName: "BillSafi",
    baseURL: env.WEB_ORIGIN,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    plugins: [createAdminPlugin()],
    disabledPaths: DISABLED_ADMIN_PATHS,
    hooks: { after: hideBannedSessions },
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      // skipped for v1
      requireEmailVerification: false,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: env.RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Not awaited so response timing does not reveal whether the account exists.
        void mailer.send(passwordResetEmail(user.email, user.name, url)).catch((error) => {
          console.error("Failed to send password reset email", error);
        });
      },
    },
    // Only openid, email and profile are requested; Google confirms the email (D055).
    socialProviders: google ? { google } : {},
    databaseHooks: {
      user: {
        // Runs only when a user row is about to be created: email sign-up and a first-time
        // Google sign-in. Existing users, admins included, never reach it. The setting is
        // read fresh, so closing registration applies on the next attempt (D065).
        create: { before: refuseWhenRegistrationClosed(db) },
      },
      account: {
        create: { before: dropProviderTokens },
        update: { before: dropProviderTokens },
      },
    },
    account: {
      // Backstop if a later feature keeps tokens: they are then encrypted at rest.
      encryptOAuthTokens: true,
      // Never merge Google into an existing account by email. Password sign-ups are not
      // email-verified, so a stranger could pre-register someone's address and keep a
      // way in after the owner signs in with Google. Those users get account_not_linked.
      accountLinking: { disableImplicitLinking: true },
    },
    // OAuth failures land back on the sign-in page, which explains the error code.
    onAPIError: { errorURL: `${env.WEB_ORIGIN}/sign-in` },
    advanced: {
      database: { generateId: "uuid" },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
