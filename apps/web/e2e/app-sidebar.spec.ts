import { expect, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail } from "./support";

test("collapse the app sidebar to an icon rail and remember it", async ({ page }) => {
  await signUp(page, "Wanjiku Kamau", uniqueEmail("sidebar"));
  await createFirstBusiness(page);

  const sidebar = page.locator("#app-navigation");
  const width = async () => (await sidebar.boundingBox())?.width ?? 0;
  const nav = page.getByRole("navigation", { name: "Main" });

  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect.poll(width).toBeLessThan(80);

  // Labels stay as accessible names, and the choice survives a reload.
  await nav.getByRole("link", { name: "Invoices" }).click();
  await expect(page).toHaveURL(/\/invoices/);
  await page.reload();
  await expect.poll(width).toBeLessThan(80);
  await expect(page.getByLabel("Business", { exact: true })).toBeHidden();

  // The rail's business button opens the full sidebar to reach the select.
  await page.getByRole("button", { name: /Switch business/ }).click();
  await expect(page.getByLabel("Business", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
  await expect.poll(width).toBeGreaterThan(250);
});
