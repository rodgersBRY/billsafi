import { describe, expect, it } from "vitest";
import {
  adminFunnelQuerySchema,
  adminRetentionQuerySchema,
  adminUsersQuerySchema,
} from "./admin.js";

describe("adminFunnelQuerySchema", () => {
  it("defaults to 30 days and reads query strings", () => {
    expect(adminFunnelQuerySchema.parse({})).toEqual({ days: 30 });
    expect(adminFunnelQuerySchema.parse({ days: "7" })).toEqual({ days: 7 });
  });

  it("rejects other windows", () => {
    expect(adminFunnelQuerySchema.safeParse({ days: "5" }).success).toBe(false);
    expect(adminFunnelQuerySchema.safeParse({ days: "abc" }).success).toBe(false);
  });
});

describe("adminRetentionQuerySchema", () => {
  it("defaults to 8 weeks and allows 4, 8 or 12", () => {
    expect(adminRetentionQuerySchema.parse({})).toEqual({ weeks: 8 });
    expect(adminRetentionQuerySchema.parse({ weeks: "12" })).toEqual({ weeks: 12 });
    expect(adminRetentionQuerySchema.safeParse({ weeks: "6" }).success).toBe(false);
  });
});

describe("adminUsersQuerySchema", () => {
  it("defaults to the first page with no search", () => {
    expect(adminUsersQuerySchema.parse({})).toEqual({ page: 1 });
  });

  it("trims the search and drops a blank one", () => {
    expect(adminUsersQuerySchema.parse({ search: "  wanjiku " }).search).toBe("wanjiku");
    expect(adminUsersQuerySchema.parse({ search: "   " }).search).toBeUndefined();
  });

  it("rejects page 0 and long searches", () => {
    expect(adminUsersQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(adminUsersQuerySchema.safeParse({ search: "x".repeat(101) }).success).toBe(false);
  });
});
