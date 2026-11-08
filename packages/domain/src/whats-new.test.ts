import { describe, expect, it } from "vitest";
import {
  isWhatsNewUnread,
  shouldPopUpWhatsNew,
  whatsNewSeenSince,
  whatsNewStatus,
} from "./whats-new.js";

const now = new Date("2026-11-08T12:00:00Z");
const hourAgo = new Date("2026-11-08T11:00:00Z");
const hourLater = new Date("2026-11-08T13:00:00Z");

describe("whatsNewStatus", () => {
  it("is draft without a publish time", () => {
    expect(whatsNewStatus(null, now)).toBe("draft");
  });

  it("is scheduled for a future time and live from that time on", () => {
    expect(whatsNewStatus(hourLater, now)).toBe("scheduled");
    expect(whatsNewStatus(now, now)).toBe("live");
    expect(whatsNewStatus(hourAgo, now)).toBe("live");
  });
});

describe("whatsNewSeenSince", () => {
  it("uses the last opened time when there is one", () => {
    expect(whatsNewSeenSince(hourAgo, new Date("2026-01-01T00:00:00Z"))).toEqual(hourAgo);
  });

  it("falls back to the sign-up time", () => {
    const signedUp = new Date("2026-01-01T00:00:00Z");
    expect(whatsNewSeenSince(null, signedUp)).toEqual(signedUp);
  });
});

describe("isWhatsNewUnread", () => {
  it("is unread only when published after the seen time", () => {
    expect(isWhatsNewUnread(now, hourAgo)).toBe(true);
    expect(isWhatsNewUnread(hourAgo, now)).toBe(false);
    expect(isWhatsNewUnread(now, now)).toBe(false);
  });
});

describe("shouldPopUpWhatsNew", () => {
  const entries = [
    { publishedAt: now, popup: false },
    { publishedAt: hourAgo, popup: true },
  ];

  it("pops up for an unread entry flagged to pop up", () => {
    expect(shouldPopUpWhatsNew(entries, new Date("2026-11-08T10:00:00Z"), false)).toBe(true);
  });

  it("stays quiet when the flagged entry was already seen", () => {
    expect(shouldPopUpWhatsNew(entries, new Date("2026-11-08T11:30:00Z"), false)).toBe(false);
  });

  it("waits while the first-run tour is due", () => {
    expect(shouldPopUpWhatsNew(entries, new Date("2026-11-08T10:00:00Z"), true)).toBe(false);
  });
});
