import { expect, test } from "@playwright/test";
import { waitUntilInteractive } from "./support";

test("unsubscribe works signed out and needs a click", async ({ page }) => {
  // A forged token gets the same answer as a real one, so the page reveals nothing.
  await page.goto("/unsubscribe?token=0199f0a8-1c2d-7e3f-8a4b-5c6d7e8f9a0b.not-a-signature");
  await expect(page).toHaveURL(/\/unsubscribe\?token=/);
  await expect(
    page.getByRole("heading", { name: "Unsubscribe from check-in emails" }),
  ).toBeVisible();
  await waitUntilInteractive(page, "Unsubscribe");
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
});

test("unsubscribe without a token explains the link is incomplete", async ({ page }) => {
  await page.goto("/unsubscribe");
  await expect(page.getByRole("heading", { name: "This link is incomplete" })).toBeVisible();
});
