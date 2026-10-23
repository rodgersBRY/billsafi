import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env.js";
import { ExchangeRateService, RATE_URL } from "./exchange-rate.service.js";

const HOUR_MS = 60 * 60 * 1000;
const published = Date.UTC(2026, 9, 23);

function rateBody(kes = 129.866552) {
  return { result: "success", time_last_update_unix: published / 1000, rates: { KES: kes } };
}

function service(env: Partial<Env> = {}) {
  return new ExchangeRateService(env as Env);
}

describe("ExchangeRateService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a pinned rate without calling the source", async () => {
    expect(await service({ USD_KES_RATE: 125 }).usdKes()).toEqual({
      rate: "125",
      updatedAt: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the published rate and caches it", async () => {
    fetchMock.mockResolvedValue(Response.json(rateBody()));
    const rates = service();

    const first = await rates.usdKes(published + HOUR_MS);
    const second = await rates.usdKes(published + HOUR_MS);

    expect(first).toEqual({ rate: "129.866552", updatedAt: new Date(published) });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(RATE_URL);
  });

  it("returns null when the source fails and nothing is cached", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    expect(await service().usdKes(published)).toBeNull();
  });

  it("rejects a malformed response", async () => {
    fetchMock.mockResolvedValue(Response.json({ result: "error" }));
    expect(await service().usdKes(published)).toBeNull();
  });

  it("refuses a rate older than two days", async () => {
    fetchMock.mockResolvedValue(Response.json(rateBody()));
    expect(await service().usdKes(published + 49 * HOUR_MS)).toBeNull();
  });
});
