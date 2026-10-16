import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies local defaults", () => {
    expect(loadEnv({})).toMatchObject({ API_PORT: 4000, WEB_ORIGIN: "http://localhost:3000" });
  });

  it("rejects an invalid web origin", () => {
    expect(() => loadEnv({ WEB_ORIGIN: "not-a-url" })).toThrow(/WEB_ORIGIN/);
  });
});
