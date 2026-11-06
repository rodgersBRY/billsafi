import { describe, expect, it } from "vitest";
import { hashLinkToken, isLinkToken, newLinkToken } from "./link-token.js";

describe("link tokens", () => {
  it("creates 43-character url-safe tokens that pass the format check", () => {
    const token = newLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isLinkToken(token)).toBe(true);
    expect(isLinkToken("short")).toBe(false);
  });

  it("hashes the same token the same way and different tokens differently", () => {
    const token = newLinkToken();
    expect(hashLinkToken(token)).toBe(hashLinkToken(token));
    expect(hashLinkToken(token)).not.toBe(hashLinkToken(newLinkToken()));
    expect(hashLinkToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
