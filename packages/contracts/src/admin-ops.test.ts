import { describe, expect, it } from "vitest";
import {
  adminHealthSchema,
  adminSettingUpdateSchema,
  adminSupportCaseCreateSchema,
  adminSupportCasesQuerySchema,
  adminSupportCaseUpdateSchema,
  adminSupportNoteCreateSchema,
  adminSupportResolveSchema,
  announcementSettingSchema,
  platformInfoSchema,
  platformSettingDefaults,
  platformSettingKeys,
  platformSettingSchemas,
  registrationSettingSchema,
  supportContactSettingSchema,
} from "./admin-ops.js";

const uuid = "0196a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const reason = "Customer asked on WhatsApp";

describe("adminHealthSchema", () => {
  it("accepts an unknown indicator with no value", () => {
    const parsed = adminHealthSchema.safeParse({
      indicators: [
        {
          key: "backups",
          label: "Backups",
          status: "unknown",
          value: null,
          detail: "Not recorded yet.",
          checkedAt: "2026-10-26T09:00:00.000Z",
          source: "Not recorded",
          staleAfterSeconds: null,
        },
      ],
      links: [],
      generatedAt: "2026-10-26T09:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a status outside the four states", () => {
    const parsed = adminHealthSchema.safeParse({
      indicators: [{ key: "x", label: "X", status: "green" }],
      links: [],
      generatedAt: "2026-10-26T09:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("adminSupportCasesQuerySchema", () => {
  it("defaults to the first page, most recently updated first", () => {
    expect(adminSupportCasesQuerySchema.parse({})).toEqual({
      page: 1,
      sort: "updated",
      dir: "desc",
    });
  });

  it("reads tabs and filters, and treats blank filters as unset", () => {
    expect(
      adminSupportCasesQuerySchema.parse({ tab: "recent", severity: "urgent", status: "" }),
    ).toMatchObject({ tab: "recent", severity: "urgent", status: undefined });
    expect(adminSupportCasesQuerySchema.safeParse({ tab: "all" }).success).toBe(false);
  });
});

describe("adminSupportCaseCreateSchema", () => {
  const valid = { accountId: uuid, title: "Payment not applied", category: "payments", reason };

  it("defaults the severity to normal and trims the title", () => {
    expect(
      adminSupportCaseCreateSchema.parse({ ...valid, title: "  Payment not applied " }),
    ).toMatchObject({
      title: "Payment not applied",
      severity: "normal",
    });
  });

  it("needs an account, a category and a reason", () => {
    expect(adminSupportCaseCreateSchema.safeParse({ ...valid, accountId: "abc" }).success).toBe(
      false,
    );
    expect(adminSupportCaseCreateSchema.safeParse({ ...valid, category: "refund" }).success).toBe(
      false,
    );
    expect(adminSupportCaseCreateSchema.safeParse({ ...valid, reason: "no" }).success).toBe(false);
  });
});

describe("adminSupportCaseUpdateSchema", () => {
  it("needs at least one field to change", () => {
    expect(adminSupportCaseUpdateSchema.safeParse({ reason }).success).toBe(false);
    expect(adminSupportCaseUpdateSchema.safeParse({ reason, severity: "high" }).success).toBe(true);
  });

  it("allows clearing the assignee but not setting resolved here", () => {
    expect(adminSupportCaseUpdateSchema.safeParse({ reason, assignedTo: null }).success).toBe(true);
    expect(adminSupportCaseUpdateSchema.safeParse({ reason, status: "resolved" }).success).toBe(
      false,
    );
  });
});

describe("adminSupportResolveSchema", () => {
  it("requires a resolution", () => {
    expect(adminSupportResolveSchema.safeParse({ reason }).success).toBe(false);
    expect(adminSupportResolveSchema.safeParse({ reason, resolution: "  " }).success).toBe(false);
    expect(
      adminSupportResolveSchema.parse({ reason, resolution: " Applied by hand " }).resolution,
    ).toBe("Applied by hand");
  });
});

describe("adminSupportNoteCreateSchema", () => {
  it("needs a body but not a reason", () => {
    expect(adminSupportNoteCreateSchema.parse({ body: " Called back " })).toEqual({
      body: "Called back",
    });
    expect(adminSupportNoteCreateSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(adminSupportNoteCreateSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("platform settings", () => {
  it("has a default that passes its own schema, for every key", () => {
    for (const key of platformSettingKeys) {
      expect(platformSettingSchemas[key].safeParse(platformSettingDefaults[key]).success).toBe(
        true,
      );
    }
  });

  it("defaults to open registration, no announcement and the support address", () => {
    expect(platformSettingDefaults.registration.open).toBe(true);
    expect(platformSettingDefaults.announcement.active).toBe(false);
    expect(platformSettingDefaults.support_contact.email).toBe("support@billsafi.com");
  });

  it("needs a closed message", () => {
    expect(registrationSettingSchema.safeParse({ open: false, closedMessage: " " }).success).toBe(
      false,
    );
  });

  it("needs an announcement message only while it is on, and caps it at 200", () => {
    expect(
      announcementSettingSchema.safeParse({ active: false, tone: "info", message: "" }).success,
    ).toBe(true);
    expect(
      announcementSettingSchema.safeParse({ active: true, tone: "info", message: "" }).success,
    ).toBe(false);
    expect(
      announcementSettingSchema.safeParse({ active: true, tone: "info", message: "x".repeat(201) })
        .success,
    ).toBe(false);
  });

  it("takes only an https link, and an end after the start", () => {
    const base = { active: true, tone: "warning", message: "Maintenance tonight" };
    expect(announcementSettingSchema.safeParse({ ...base, linkUrl: "http://x.test" }).success).toBe(
      false,
    );
    expect(
      announcementSettingSchema.parse({
        ...base,
        linkUrl: "https://billsafi.com/status",
        startsAt: "",
      }),
    ).toMatchObject({ linkUrl: "https://billsafi.com/status" });
    expect(
      announcementSettingSchema.safeParse({
        ...base,
        startsAt: "2026-10-27T10:00:00Z",
        endsAt: "2026-10-27T09:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("checks the support contact", () => {
    expect(supportContactSettingSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(
      supportContactSettingSchema.safeParse({ email: "a@b.co", whatsapp: "0712345678" }).success,
    ).toBe(false);
    expect(
      supportContactSettingSchema.parse({ email: "a@b.co", whatsapp: "+254712345678", hours: "" }),
    ).toEqual({
      email: "a@b.co",
      whatsapp: "+254712345678",
    });
  });

  it("builds an update body per key and demands a reason", () => {
    const schema = adminSettingUpdateSchema("registration");
    expect(
      schema.safeParse({ value: { open: false, closedMessage: "Paused" }, reason }).success,
    ).toBe(true);
    expect(schema.safeParse({ value: { open: false, closedMessage: "Paused" } }).success).toBe(
      false,
    );
    expect(schema.safeParse({ value: { open: "no" }, reason }).success).toBe(false);
  });
});

describe("platformInfoSchema", () => {
  it("strips any field the public must not see", () => {
    const parsed = platformInfoSchema.parse({
      registration: { open: true, closedMessage: "Paused", updatedBy: "someone" },
      announcement: null,
      supportContact: { email: "support@billsafi.com" },
      secret: 1,
    });
    expect(Object.keys(parsed).sort()).toEqual(["announcement", "registration", "supportContact"]);
    expect(parsed.registration).toEqual({ open: true, closedMessage: "Paused" });
  });
});
