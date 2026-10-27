import { describe, expect, it } from "vitest";
import {
  adminFailedSignInsPageSchema,
  adminFailedSignInsQuerySchema,
  adminFailuresPageSchema,
  adminFailuresQuerySchema,
  adminTenantActivityPageSchema,
  eventPropsSchemas,
  generatorEventNames,
  productEventNames,
  publicEventSchema,
} from "./activity.js";
import { importGuestInvoiceSchema } from "./guest-invoices.js";

const anonymousId = "0190f4e0-7b1a-7c3e-9d2a-4f5a6b7c8d9e";

describe("publicEventSchema", () => {
  it("accepts each generator event with no props", () => {
    for (const name of generatorEventNames) {
      expect(publicEventSchema.safeParse({ name, anonymousId }).success).toBe(true);
      expect(publicEventSchema.safeParse({ name, anonymousId, props: {} }).success).toBe(true);
    }
  });

  it("refuses server-side and unknown names", () => {
    for (const name of ["pdf_downloaded", "link_opened", "guest_invoice_imported", "page_view"]) {
      expect(publicEventSchema.safeParse({ name, anonymousId }).success).toBe(false);
    }
  });

  it("refuses a bad anonymous id, extra fields, extra props and oversized props", () => {
    const name = "generator_started";
    expect(publicEventSchema.safeParse({ name, anonymousId: "abc" }).success).toBe(false);
    expect(publicEventSchema.safeParse({ name }).success).toBe(false);
    expect(publicEventSchema.safeParse({ name, anonymousId, accountId: "x" }).success).toBe(false);
    expect(publicEventSchema.safeParse({ name, anonymousId, props: { a: 1 } }).success).toBe(false);
    expect(
      publicEventSchema.safeParse({ name, anonymousId, props: { a: "x".repeat(2000) } }).success,
    ).toBe(false);
  });
});

describe("eventPropsSchemas", () => {
  it("has a schema for every event name and no more", () => {
    expect(Object.keys(eventPropsSchemas).sort()).toEqual([...productEventNames].sort());
  });

  it("checks the pdf source", () => {
    expect(eventPropsSchemas.pdf_downloaded.safeParse({ source: "app" }).success).toBe(true);
    expect(eventPropsSchemas.pdf_downloaded.safeParse({ source: "email" }).success).toBe(false);
    expect(eventPropsSchemas.pdf_downloaded.safeParse({}).success).toBe(false);
  });
});

describe("admin query schemas", () => {
  it("defaults the failed sign-in filters", () => {
    expect(adminFailedSignInsQuerySchema.parse({})).toEqual({ page: 1, range: "7d" });
    expect(
      adminFailedSignInsQuerySchema.parse({ method: "google", reason: "banned", email: "a@b" }),
    ).toMatchObject({ method: "google", reason: "banned", email: "a@b" });
    expect(adminFailedSignInsQuerySchema.safeParse({ reason: "nope" }).success).toBe(false);
  });

  it("reads the failure kind filter", () => {
    expect(adminFailuresQuerySchema.parse({ kind: "" })).toEqual({ page: 1 });
    expect(adminFailuresQuerySchema.parse({ kind: "pdf", page: "2" })).toEqual({
      kind: "pdf",
      page: 2,
    });
    expect(adminFailuresQuerySchema.safeParse({ kind: "mpesa" }).success).toBe(false);
  });
});

describe("admin responses", () => {
  it("reads a failed sign-ins page with a null email", () => {
    const body = {
      page: 1,
      pageSize: 25,
      total: 1,
      items: [
        {
          id: "1",
          occurredAt: "2031-03-17T11:00:00.000Z",
          email: null,
          method: "google",
          reason: "other",
          ipMasked: null,
        },
      ],
      summary: { last24h: 1, last7d: 1, topEmails: [], topIps: [] },
      generatedAt: "2031-03-17T11:00:00.000Z",
    };
    expect(adminFailedSignInsPageSchema.parse(body)).toEqual(body);
  });

  it("reads failures and tenant activity pages", () => {
    const base = { page: 1, pageSize: 25, total: 0, items: [], generatedAt: "x" };
    expect(
      adminFailuresPageSchema.parse({ ...base, last24h: { pdf: 0, email: 0, job: 0 } }),
    ).toBeTruthy();
    expect(adminTenantActivityPageSchema.parse({ ...base, accountId: "a" })).toBeTruthy();
  });
});

describe("importGuestInvoiceSchema anonymousId", () => {
  const draft = {
    business: {
      profileType: "individual",
      displayName: "Amani Njeri",
      contactEmail: "amani@example.test",
      phone: "0712 345 678",
    },
    client: { name: "Karibu Coffee", phone: "0722 111 222" },
    invoice: {
      issueDate: "2026-10-16",
      dueDate: "2026-10-30",
      items: [{ description: "Logo design", quantity: "1", unitPrice: "15000" }],
    },
  };

  it("keeps a valid id and drops a bad one without failing the import", () => {
    expect(importGuestInvoiceSchema.parse({ ...draft, anonymousId }).anonymousId).toBe(anonymousId);
    const bad = importGuestInvoiceSchema.safeParse({ ...draft, anonymousId: "nope" });
    expect(bad.success).toBe(true);
    expect(bad.data?.anonymousId).toBeUndefined();
  });
});
