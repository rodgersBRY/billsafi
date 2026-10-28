import { defineConfig } from "@playwright/test";

// Browser tests run against built apps: `pnpm build` first, with Postgres up.
// Email browser coverage additionally requires MAILPIT_URL and an API SMTP relay to that inbox.
// PLAYWRIGHT_BASE_URL points them at servers you started yourself (none are started then).
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseUrl ?? "http://localhost:3000",
    // Uses the installed Chrome; no browser download needed locally.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: "pnpm --filter @billsafi/api start",
          url: "http://localhost:4000/api/v1/health",
          reuseExistingServer: !process.env.CI,
          cwd: "../..",
        },
        {
          command: "pnpm --filter @billsafi/web start",
          url: "http://localhost:3000/sign-in",
          reuseExistingServer: !process.env.CI,
          cwd: "../..",
        },
      ],
});
