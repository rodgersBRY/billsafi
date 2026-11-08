import { expect, type Page, test } from "@playwright/test";
import type { WhatsNewFeed } from "@billsafi/contracts";
import { createFirstBusiness, signIn, signUp, uniqueEmail } from "./support";

const entry = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Recurring invoices",
  body: "BillSafi makes the invoice for you each period.",
  linkSegment: "recurring" as const,
  pro: true,
  publishedAt: "2026-11-08T06:00:00.000Z",
  unread: true,
};

/** Serves a fake feed and counts calls to the seen endpoint. */
async function mockFeed(page: Page, feed: WhatsNewFeed) {
  const seen = { calls: 0 };
  let current = feed;
  await page.route("**/api/v1/whats-new", (route) => route.fulfill({ json: current }));
  await page.route("**/api/v1/whats-new/seen", (route) => {
    seen.calls += 1;
    current = {
      entries: current.entries.map((e) => ({ ...e, unread: false })),
      unreadCount: 0,
      popup: false,
    };
    return route.fulfill({ status: 204 });
  });
  return seen;
}

test("a flagged entry opens the panel once, and closing it clears the count", async ({ page }) => {
  await signUp(page, "Achieng Otieno", uniqueEmail("whats-new-popup"));
  await createFirstBusiness(page);

  const seen = await mockFeed(page, { entries: [entry], unreadCount: 1, popup: true });
  await page.reload();

  const panel = page.getByRole("dialog", { name: "What's new" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Recurring invoices" })).toBeVisible();
  // A Free account gets the upgrade button on a Pro entry.
  await expect(panel.getByRole("link", { name: "Upgrade to Pro" })).toBeVisible();
  await expect.poll(() => seen.calls).toBe(1);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: /What's new \(\d+ unread\)/ })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "What's new" })).toBeVisible();
  await expect(panel).toBeHidden();
});

test("the sidebar button shows the count and opens the panel with the page link", async ({
  page,
}) => {
  await signUp(page, "Kamau Njoroge", uniqueEmail("whats-new-button"));
  await createFirstBusiness(page);

  await mockFeed(page, {
    entries: [{ ...entry, pro: false, linkSegment: "quotes", title: "Quotes" }],
    unreadCount: 1,
    popup: false,
  });
  await page.reload();

  const button = page.getByRole("button", { name: "What's new (1 unread)" });
  await expect(button).toBeVisible();
  await expect(page.getByRole("dialog", { name: "What's new" })).toBeHidden();

  await button.click();
  const panel = page.getByRole("dialog", { name: "What's new" });
  await panel.getByRole("link", { name: "Open Quotes" }).click();
  await expect(page).toHaveURL(/\/quotes/);
  await expect(panel).toBeHidden();
});

test("an empty feed says so", async ({ page }) => {
  await signUp(page, "Wairimu Mwangi", uniqueEmail("whats-new-empty"));
  await createFirstBusiness(page);
  await mockFeed(page, { entries: [], unreadCount: 0, popup: false });
  await page.reload();

  await page.getByRole("button", { name: "What's new" }).click();
  await expect(page.getByRole("dialog", { name: "What's new" })).toContainText("Nothing new yet.");
});

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("as an admin", () => {
  test.skip(!adminEmail || !adminPassword, "Needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  test("creates a draft entry with a reason and deletes it", async ({ page }) => {
    const title = `Browser test ${crypto.randomUUID().slice(0, 8)}`;
    await signIn(page, adminEmail!, adminPassword!);
    await page.goto("/admin/whats-new");
    await expect(page.getByRole("heading", { name: "What's new", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "New entry" }).click();
    const dialog = page.getByRole("dialog", { name: "New entry" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Text").fill("Made in a browser test.");
    await dialog.getByLabel(/Reason/).fill("Browser test: draft entry");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    const drafts = page.getByRole("region", { name: /Drafts/ });
    const row = drafts.getByRole("listitem").filter({ hasText: title });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this entry?" });
    await confirm.getByLabel(/Reason/).fill("Browser test: clean up");
    await confirm.getByRole("button", { name: "Delete entry" }).click();
    await expect(confirm).toBeHidden();
    await expect(drafts.getByText(title)).toHaveCount(0);
  });
});
