import { describe, expect, it } from "vitest";
import {
  adminActionBodySchema,
  adminAuditLogsQuerySchema,
  adminFunnelQuerySchema,
  adminRetentionQuerySchema,
  adminTenantsQuerySchema,
  adminUsersQuerySchema,
  reasonSchema,
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
  it("defaults to the first page, newest first, with no filters", () => {
    expect(adminUsersQuerySchema.parse({})).toEqual({ page: 1, sort: "registered", dir: "desc" });
  });

  it("trims the search and drops a blank one", () => {
    expect(adminUsersQuerySchema.parse({ search: "  wanjiku " }).search).toBe("wanjiku");
    expect(adminUsersQuerySchema.parse({ search: "   " }).search).toBeUndefined();
  });

  it("reads filters and treats empty ones as unset", () => {
    expect(
      adminUsersQuerySchema.parse({
        role: "admin",
        accountStatus: "suspended",
        signInMethod: "google",
        sort: "lastLogin",
        dir: "asc",
      }),
    ).toMatchObject({ role: "admin", accountStatus: "suspended", signInMethod: "google" });
    expect(adminUsersQuerySchema.parse({ role: "", sort: "", dir: "" })).toEqual({
      page: 1,
      sort: "registered",
      dir: "desc",
    });
  });

  it("rejects page 0, long searches and unknown values", () => {
    expect(adminUsersQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(adminUsersQuerySchema.safeParse({ search: "x".repeat(101) }).success).toBe(false);
    expect(adminUsersQuerySchema.safeParse({ role: "owner" }).success).toBe(false);
    expect(adminUsersQuerySchema.safeParse({ sort: "name" }).success).toBe(false);
  });
});

describe("adminTenantsQuerySchema", () => {
  it("defaults to registered, newest first", () => {
    expect(adminTenantsQuerySchema.parse({})).toEqual({
      page: 1,
      sort: "registered",
      dir: "desc",
    });
  });

  it("reads every filter from query strings", () => {
    expect(
      adminTenantsQuerySchema.parse({
        page: "2",
        search: "studio",
        accountStatus: "active",
        subscriptionStatus: "pro_ending",
        lifecycle: "inactive",
        signedUp: "30",
        activeWithin: "7",
        sort: "readyInvoices",
        dir: "asc",
      }),
    ).toEqual({
      page: 2,
      search: "studio",
      accountStatus: "active",
      subscriptionStatus: "pro_ending",
      lifecycle: "inactive",
      signedUp: 30,
      activeWithin: 7,
      sort: "readyInvoices",
      dir: "asc",
    });
    expect(adminTenantsQuerySchema.parse({ inactiveFor: "30" }).inactiveFor).toBe(30);
  });

  it("rejects other windows, unknown statuses and both activity filters at once", () => {
    expect(adminTenantsQuerySchema.safeParse({ signedUp: "14" }).success).toBe(false);
    expect(adminTenantsQuerySchema.safeParse({ inactiveFor: "7" }).success).toBe(false);
    expect(adminTenantsQuerySchema.safeParse({ lifecycle: "churned" }).success).toBe(false);
    expect(
      adminTenantsQuerySchema.safeParse({ activeWithin: "7", inactiveFor: "30" }).success,
    ).toBe(false);
  });
});

describe("adminAuditLogsQuerySchema", () => {
  it("defaults to the first page with no filters", () => {
    expect(adminAuditLogsQuerySchema.parse({})).toEqual({ page: 1 });
  });

  it("reads filters and checks dates", () => {
    const actorId = "0196a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    expect(
      adminAuditLogsQuerySchema.parse({
        action: "tenant.suspend",
        targetType: "account",
        targetId: actorId,
        actorId,
        outcome: "failure",
        from: "2026-10-01",
        to: "2026-10-25",
      }),
    ).toMatchObject({ outcome: "failure", from: "2026-10-01", to: "2026-10-25" });
    expect(
      adminAuditLogsQuerySchema.safeParse({ from: "2026-10-26", to: "2026-10-25" }).success,
    ).toBe(false);
    expect(adminAuditLogsQuerySchema.safeParse({ from: "yesterday" }).success).toBe(false);
    expect(adminAuditLogsQuerySchema.safeParse({ actorId: "system" }).success).toBe(false);
    expect(adminAuditLogsQuerySchema.safeParse({ outcome: "maybe" }).success).toBe(false);
  });
});

describe("reasonSchema", () => {
  it("trims and accepts 5 to 500 characters", () => {
    expect(reasonSchema.parse("  Fraud report  ")).toBe("Fraud report");
    expect(reasonSchema.parse("x".repeat(500))).toHaveLength(500);
  });

  it("rejects missing, short and long reasons", () => {
    expect(reasonSchema.safeParse(undefined).success).toBe(false);
    expect(reasonSchema.safeParse("   abc   ").success).toBe(false);
    expect(reasonSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("is required in an action body", () => {
    expect(adminActionBodySchema.safeParse({}).success).toBe(false);
    expect(adminActionBodySchema.parse({ reason: "Owner asked" })).toEqual({
      reason: "Owner asked",
    });
  });
});
