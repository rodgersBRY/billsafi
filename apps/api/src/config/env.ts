import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32, "Use at least 32 random characters"),
    RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
    SMTP_URL: z.url({ protocol: /^smtps?$/ }),
    MAIL_FROM: z.string().min(3).default("TallyNest <no-reply@tallynest.local>"),
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
    /** Runs the renewal reminder job inside the API process. */
    BILLING_JOBS: z
      .enum(["on", "off"])
      .default("on")
      .transform((value) => value === "on"),
  })
  .superRefine((env, ctx) => {
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
  });

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
