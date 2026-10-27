import { TtlCache } from "./ttl-cache.js";

describe("TtlCache", () => {
  it("reuses a value until it expires", async () => {
    let time = 0;
    const cache = new TtlCache(60_000, () => time);
    let loads = 0;
    const load = async () => ++loads;

    expect(await cache.get("overview", load)).toBe(1);
    time = 59_999;
    expect(await cache.get("overview", load)).toBe(1);
    time = 60_000;
    expect(await cache.get("overview", load)).toBe(2);
  });

  it("keeps keys apart", async () => {
    const cache = new TtlCache();
    expect(await cache.get("a", async () => "a")).toBe("a");
    expect(await cache.get("b", async () => "b")).toBe("b");
  });

  it("does not keep a failed load", async () => {
    const cache = new TtlCache();
    await expect(cache.get("x", () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    expect(await cache.get("x", async () => "ok")).toBe("ok");
  });

  it("forgets entries by key prefix", async () => {
    const cache = new TtlCache();
    let loads = 0;
    const load = async () => ++loads;
    await cache.get("tenants:a", load);
    await cache.get("users:a", load);
    cache.invalidate("tenants:");
    expect(await cache.get("tenants:a", load)).toBe(3);
    expect(await cache.get("users:a", load)).toBe(2);
  });
});
