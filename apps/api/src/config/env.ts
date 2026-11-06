import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32, "Use at least 32 random characters"),
    RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    /** Google OAuth web client; Google sign-in is off unless both are set (D055). */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    /**
     * Where email goes (D070). log prints each email to the API console and never
     * sends. Unset means log outside production, and in production Resend when
     * RESEND_API_KEY is set, otherwise SMTP.
     */
    MAIL_DRIVER: z.enum(["log", "resend", "smtp"]).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    MAIL_FROM: z.string().min(3).default("BillSafi <no-reply@billsafi.local>"),
    /**
     * fake never calls Safaricom; sandbox and production use Daraja; disabled
     * refuses checkout until the Paybill is approved (D051).
     */
    MPESA_ENV: z.enum(["fake", "disabled", "sandbox", "production"]).default("fake"),
    MPESA_CONSUMER_KEY: z.string().optional(),
    MPESA_CONSUMER_SECRET: z.string().optional(),
    MPESA_SHORTCODE: z
      .string()
      .regex(/^\d{5,7}$/, "Use the Paybill number")
      .default("174379"),
    MPESA_PASSKEY: z.string().optional(),
    /** Public HTTPS origin Safaricom can reach, such as a tunnel in development. */
    MPESA_CALLBACK_URL: z.url({ protocol: /^https$/ }).optional(),
    /** Secret path segment that marks a callback as coming from our own STK request. */
    MPESA_CALLBACK_TOKEN: z.string().min(24, "Use at least 24 random characters").optional(),
    /**
     * Pins the USD to KES rate used for plan prices. Leave unset to use the
     * daily published rate; set it for tests or if the rate source is down.
     */
    USD_KES_RATE: z.coerce.number().positive().optional(),
    /** Sentry project DSN for API errors; reporting is off when unset (D052). */
    SENTRY_DSN: z.url().optional(),
    /**
     * User IDs given the platform admin role on every API start (D057), comma
     * separated; anyone else holding it is demoted. IDs, not emails: emails are
     * not verified, so an unregistered email could be claimed by someone else.
     * Empty or unset leaves nobody as admin.
     */
    ADMIN_USER_IDS: z
      .string()
      .optional()
      .transform((value) => [
        ...new Set(
          (value ?? "")
            .split(",")
            .map((id) => id.trim().toLowerCase())
            .filter(Boolean),
        ),
      ])
      .pipe(z.array(z.uuid("ADMIN_USER_IDS must be a comma-separated list of user IDs (UUIDs)"))),
    /**
     * Optional links shown on the admin Health page (D065): the Sentry project and the
     * uptime monitor's status page. The page hides a card when its variable is unset.
     */
    ADMIN_SENTRY_URL: z.url({ protocol: /^https$/ }).optional(),
    ADMIN_UPTIME_URL: z.url({ protocol: /^https$/ }).optional(),
    /** Runs the renewal reminder job inside the API process. */
    BILLING_JOBS: z
      .enum(["on", "off"])
      .default("on")
      .transform((value) => value === "on"),
    /** Runs the daily job that deletes recorded facts past their retention (D066). */
    MAINTENANCE_JOBS: z
      .enum(["on", "off"])
      .default("on")
      .transform((value) => value === "on"),
    /**
     * Sends check-in emails to quiet accounts (D069). Off by default: it emails real
     * people, so turn it on deliberately.
     */
    REENGAGEMENT_JOBS: z
      .enum(["on", "off"])
      .default("off")
      .transform((value) => value === "on"),
    /** Most check-in emails sent in any 24 hours, so a backlog goes out slowly. */
    REENGAGEMENT_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(40),
    /** A monitored inbox: the last check-in email asks people to reply. */
    REENGAGEMENT_REPLY_TO: z.email().optional(),
    /** Sign-off on the personal check-in email, such as a first name. */
    REENGAGEMENT_SIGNATURE: z.string().trim().min(1).max(80).default("The BillSafi team"),
  })
  .superRefine((env, ctx) => {
    if (env.REENGAGEMENT_JOBS && !env.REENGAGEMENT_REPLY_TO) {
      ctx.addIssue({
        code: "custom",
        path: ["REENGAGEMENT_REPLY_TO"],
        message: "Required when REENGAGEMENT_JOBS is on",
      });
    }
    const mailDriver = resolveMailDriver(env);
    if (mailDriver === "log" && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_DRIVER"],
        message: "The log driver never delivers email; use resend or smtp",
      });
    }
    if (mailDriver === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: env.MAIL_DRIVER
          ? "Required when MAIL_DRIVER is resend"
          : "Set RESEND_API_KEY or SMTP_URL for email delivery",
      });
    }
    if (mailDriver === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "Required when MAIL_DRIVER is smtp",
      });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: [env.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
        message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
      });
    }
    if (env.MPESA_ENV === "fake" && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["MPESA_ENV"],
        message:
          "The fake provider grants Pro without payment; use disabled, sandbox, or production",
      });
    }
    if (env.MPESA_ENV === "fake" || env.MPESA_ENV === "disabled") return;
    for (const key of [
      "MPESA_CONSUMER_KEY",
      "MPESA_CONSUMER_SECRET",
      "MPESA_PASSKEY",
      "MPESA_CALLBACK_URL",
      "MPESA_CALLBACK_TOKEN",
    ] as const) {
      if (!env[key])
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Required when MPESA_ENV is ${env.MPESA_ENV}`,
        });
    }
  })
  .transform((env) => ({ ...env, MAIL_DRIVER: resolveMailDriver(env) }));

type MailDriver = "log" | "resend" | "smtp";

function resolveMailDriver(env: {
  NODE_ENV: string;
  MAIL_DRIVER?: MailDriver | undefined;
  RESEND_API_KEY?: string | undefined;
  SMTP_URL?: string | undefined;
}): MailDriver {
  if (env.MAIL_DRIVER) return env.MAIL_DRIVER;
  if (env.NODE_ENV !== "production") return "log";
  return env.RESEND_API_KEY || !env.SMTP_URL ? "resend" : "smtp";
}

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Blank lines copied from .env.example mean "not set".
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
