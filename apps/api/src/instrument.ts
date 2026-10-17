import * as Sentry from "@sentry/nestjs";
import { loadRootEnvFile } from "./config/env-file.js";

// Imported first in main.ts so Sentry sees every module that loads after it.
loadRootEnvFile();

/** Error reporting only (D052); it stays off when no DSN is configured. */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.APP_RELEASE,
    tracesSampleRate: 0,
  });
  console.log("Sentry error reporting is on");
}
