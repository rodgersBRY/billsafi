import { loadEnv } from "./env.js";

const required = {
  DATABASE_URL: "postgres://billsafi:billsafi@localhost:5434/billsafi",
  BETTER_AUTH_SECRET: "x".repeat(32),
  SMTP_URL: "smtps://smtp.example.test:465",
  RESET_TOKEN_TTL_SECONDS: "3600",
};

describe("loadEnv", () => {
  it("applies local defaults", () => {
    expect(loadEnv(required)).toMatchObject({
      API_PORT: 4000,
      WEB_ORIGIN: "http://localhost:3000",
    });
  });

  it("logs email instead of sending it outside production by default", () => {
    expect(loadEnv({ ...required, RESEND_API_KEY: "re_test" }).MAIL_DRIVER).toBe("log");
    expect(loadEnv({ ...required, SMTP_URL: undefined }).MAIL_DRIVER).toBe("log");
  });

  it("picks Resend, then SMTP, in production when MAIL_DRIVER is unset", () => {
    const production = { ...required, NODE_ENV: "production", MPESA_ENV: "disabled" };
    expect(loadEnv({ ...production, RESEND_API_KEY: "re_test" }).MAIL_DRIVER).toBe("resend");
    expect(loadEnv(production).MAIL_DRIVER).toBe("smtp");
    expect(() => loadEnv({ ...production, SMTP_URL: undefined })).toThrow(/RESEND_API_KEY/);
  });

  it("uses an explicit MAIL_DRIVER and requires what it needs", () => {
    expect(loadEnv({ ...required, MAIL_DRIVER: "smtp" }).MAIL_DRIVER).toBe("smtp");
    expect(() => loadEnv({ ...required, MAIL_DRIVER: "resend" })).toThrow(
      /Required when MAIL_DRIVER is resend/,
    );
    expect(() => loadEnv({ ...required, SMTP_URL: undefined, MAIL_DRIVER: "smtp" })).toThrow(
      /Required when MAIL_DRIVER is smtp/,
    );
  });

  it("refuses the log driver in production", () => {
    expect(() =>
      loadEnv({ ...required, NODE_ENV: "production", MPESA_ENV: "disabled", MAIL_DRIVER: "log" }),
    ).toThrow(/MAIL_DRIVER/);
  });

  it("reads the admin user IDs as a clean lowercase list", () => {
    const id = "0196a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    const other = "11111111-2222-4333-8444-555555555555";
    expect(loadEnv(required).ADMIN_USER_IDS).toEqual([]);
    expect(
      loadEnv({ ...required, ADMIN_USER_IDS: ` ${id.toUpperCase()} , ,${other},${id}` })
        .ADMIN_USER_IDS,
    ).toEqual([id, other]);
  });

  it("rejects an admin entry that is not a user ID", () => {
    expect(() => loadEnv({ ...required, ADMIN_USER_IDS: "brian@example.com" })).toThrow(
      /ADMIN_USER_IDS/,
    );
  });

  it("requires a Postgres database URL", () => {
    expect(() => loadEnv({ ...required, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...required, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a short auth secret", () => {
    expect(() => loadEnv({ ...required, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("accepts Google OAuth settings only as a pair", () => {
    expect(loadEnv(required).GOOGLE_CLIENT_ID).toBeUndefined();
    expect(
      loadEnv({ ...required, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }),
    ).toMatchObject({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    expect(() => loadEnv({ ...required, GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => loadEnv({ ...required, GOOGLE_CLIENT_SECRET: "secret" })).toThrow(
      /GOOGLE_CLIENT_ID/,
    );
  });

  it("rejects an invalid web origin", () => {
    expect(() => loadEnv({ ...required, WEB_ORIGIN: "not-a-url" })).toThrow(/WEB_ORIGIN/);
  });

  it("reads the optional admin link-out URLs and ignores blanks", () => {
    expect(loadEnv(required).ADMIN_SENTRY_URL).toBeUndefined();
    expect(
      loadEnv({
        ...required,
        ADMIN_SENTRY_URL: "https://sentry.io/organizations/billsafi",
        ADMIN_UPTIME_URL: "",
      }),
    ).toMatchObject({ ADMIN_SENTRY_URL: "https://sentry.io/organizations/billsafi" });
  });

  it("rejects admin link-out URLs that are not https", () => {
    expect(() => loadEnv({ ...required, ADMIN_UPTIME_URL: "http://status.example.test" })).toThrow(
      /ADMIN_UPTIME_URL/,
    );
    expect(() => loadEnv({ ...required, ADMIN_SENTRY_URL: "sentry" })).toThrow(/ADMIN_SENTRY_URL/);
  });

  it("turns the maintenance job on by default and reads on and off only", () => {
    expect(loadEnv(required).MAINTENANCE_JOBS).toBe(true);
    expect(loadEnv({ ...required, MAINTENANCE_JOBS: "off" }).MAINTENANCE_JOBS).toBe(false);
    expect(() => loadEnv({ ...required, MAINTENANCE_JOBS: "maybe" })).toThrow(/MAINTENANCE_JOBS/);
  });

  it("keeps check-in emails off unless switched on with a reply-to inbox", () => {
    expect(loadEnv(required).REENGAGEMENT_JOBS).toBe(false);
    expect(loadEnv(required).REENGAGEMENT_DAILY_LIMIT).toBe(40);
    expect(() => loadEnv({ ...required, REENGAGEMENT_JOBS: "on" })).toThrow(
      /REENGAGEMENT_REPLY_TO/,
    );
    const on = loadEnv({
      ...required,
      REENGAGEMENT_JOBS: "on",
      REENGAGEMENT_REPLY_TO: "hello@example.test",
    });
    expect(on.REENGAGEMENT_JOBS).toBe(true);
  });
});
