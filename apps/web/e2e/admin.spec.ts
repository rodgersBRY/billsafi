import { expect, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail } from "./support";

// The admin-positive path is not covered here. Better Auth picks user ids at
// sign-up and the API reads ADMIN_USER_IDS once at start, so a browser test
// cannot make a fresh user an admin. The API e2e tests cover the admin
// responses, and docs/superpowers/plans/2026-10-24-admin-dashboard.md lists
// the manual check. These tests cover what everyone else sees.

test("a signed-in user who is not an admin gets a real 404 on /admin", async ({ page }) => {
  await signUp(page, "Wanjiru Kamau", uniqueEmail("admin-no"));
  await createFirstBusiness(page);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);

  const tab = await page.goto("/admin?tab=billing");
  expect(tab?.status()).toBe(404);
});

test("a signed-out visitor on /admin is sent to sign-in like any private page", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/admin?tab=users");
  await expect(page).toHaveURL(/\/sign-in$/);
});
