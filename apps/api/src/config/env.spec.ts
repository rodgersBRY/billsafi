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
});
