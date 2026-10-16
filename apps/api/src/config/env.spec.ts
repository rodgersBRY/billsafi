import { loadEnv } from "./env.js";

const DATABASE_URL = "postgres://tallynest:tallynest@localhost:5434/tallynest";

describe("loadEnv", () => {
  it("applies local defaults", () => {
    expect(loadEnv({ DATABASE_URL })).toMatchObject({
      API_PORT: 4000,
      WEB_ORIGIN: "http://localhost:3000",
    });
  });

  it("requires a Postgres database URL", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(/DATABASE_URL/);
  });

  it("rejects an invalid web origin", () => {
    expect(() => loadEnv({ DATABASE_URL, WEB_ORIGIN: "not-a-url" })).toThrow(/WEB_ORIGIN/);
  });
});
