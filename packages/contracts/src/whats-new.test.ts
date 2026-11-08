import { describe, expect, it } from "vitest";
import {
  adminWhatsNewSaveSchema,
  WHATS_NEW_BODY_MAX,
  WHATS_NEW_TITLE_MAX,
  whatsNewEntryInputSchema,
} from "./whats-new.js";

const valid = { title: "Recurring invoices", body: "Make an invoice each period." };

describe("whatsNewEntryInputSchema", () => {
  it("accepts a minimal entry and fills the defaults", () => {
    expect(whatsNewEntryInputSchema.parse(valid)).toEqual({
      ...valid,
      pro: false,
      popup: false,
    });
  });

  it("trims and limits the title and body", () => {
    const result = whatsNewEntryInputSchema.safeParse({
      title: " ".repeat(3),
      body: "x".repeat(WHATS_NEW_BODY_MAX + 1),
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join("."));
    expect(paths.sort()).toEqual(["body", "title"]);
    expect(
      whatsNewEntryInputSchema.safeParse({ ...valid, title: "x".repeat(WHATS_NEW_TITLE_MAX) })
        .success,
    ).toBe(true);
  });

  it("only links to known app pages and treats blank as no link", () => {
    expect(whatsNewEntryInputSchema.parse({ ...valid, linkSegment: "" }).linkSegment).toBe(
      undefined,
    );
    expect(whatsNewEntryInputSchema.parse({ ...valid, linkSegment: "recurring" }).linkSegment).toBe(
      "recurring",
    );
    expect(whatsNewEntryInputSchema.safeParse({ ...valid, linkSegment: "admin" }).success).toBe(
      false,
    );
  });

  it("needs a publish time with an offset, and blank means draft", () => {
    expect(whatsNewEntryInputSchema.parse({ ...valid, publishedAt: "" }).publishedAt).toBe(
      undefined,
    );
    expect(
      whatsNewEntryInputSchema.parse({ ...valid, publishedAt: "2026-11-08T09:00:00+03:00" })
        .publishedAt,
    ).toBe("2026-11-08T09:00:00+03:00");
    expect(
      whatsNewEntryInputSchema.safeParse({ ...valid, publishedAt: "2026-11-08 09:00" }).success,
    ).toBe(false);
  });
});

describe("adminWhatsNewSaveSchema", () => {
  it("needs a reason", () => {
    expect(adminWhatsNewSaveSchema.safeParse(valid).success).toBe(false);
    expect(
      adminWhatsNewSaveSchema.safeParse({ ...valid, reason: "Recurring shipped" }).success,
    ).toBe(true);
  });
});
