import * as Sentry from "@sentry/nextjs";

// Browser error reporting. The DSN is public and fixed at build time (D052).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0 });
}
