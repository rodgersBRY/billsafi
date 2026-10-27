import type { NextFunction, Request, Response } from "express";
import { type RequestWithId, requestId } from "./request-id.js";

function run(header?: string | string[]) {
  const req = {
    headers: header === undefined ? {} : { "x-request-id": header },
  } as unknown as Request;
  const set: Record<string, string> = {};
  const res = {
    setHeader: (name: string, value: string) => (set[name] = value),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  requestId(req, res, next);
  expect(next).toHaveBeenCalledOnce();
  return { id: (req as RequestWithId).requestId, header: set["x-request-id"] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("requestId", () => {
  it("keeps a safe incoming ID and echoes it", () => {
    expect(run("edge-abc_123")).toEqual({ id: "edge-abc_123", header: "edge-abc_123" });
  });

  it("generates a UUID when none is sent", () => {
    const { id, header } = run();
    expect(id).toMatch(UUID);
    expect(header).toBe(id);
  });

  it.each([["a".repeat(101)], ["bad id"], ["line\nbreak"], ["<script>"], [""], [["a", "b"]]])(
    "replaces an unsafe incoming ID %#",
    (value) => {
      expect(run(value).id).toMatch(UUID);
    },
  );
});
