import { defineConfig } from "@playwright/test";

// Browser tests run against built apps: `pnpm build` first, with Postgres and Mailpit up.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    // Uses the installed Chrome; no browser download needed locally.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
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
