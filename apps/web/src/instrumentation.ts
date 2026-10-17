import * as Sentry from "@sentry/nextjs";

/** Server-side error reporting; off when SENTRY_DSN is unset (D052). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
