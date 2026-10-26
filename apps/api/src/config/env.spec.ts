import { loadEnv } from "./env.js";

const required = {
  DATABASE_URL: "postgres://billsafi:billsafi@localhost:5434/billsafi",
  BETTER_AUTH_SECRET: "x".repeat(32),
  SMTP_URL: "smtp://localhost:1025",
  RESET_TOKEN_TTL_SECONDS: "3600",
};

describe("loadEnv", () => {
  it("applies local defaults", () => {
    expect(loadEnv(required)).toMatchObject({
      API_PORT: 4000,
      WEB_ORIGIN: "http://localhost:3000",
    });
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
});
