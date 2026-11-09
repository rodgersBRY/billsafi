import { expect, type Page, test } from "@playwright/test";
import {
  createFirstBusiness,
  signUp,
  uniqueEmail,
  upgradeToPro,
  waitUntilInteractive,
} from "./support";

const main = (page: Page) => page.getByRole("main");
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });

async function addClient(page: Page) {
  await page.getByRole("button", { name: "New client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByLabel("Client name").fill("Njeri Wambui");
  await dialog.getByLabel("Phone").fill("0711 000 111");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(field(page, "Client")).toHaveValue(/.+/);
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test("free accounts see an upgrade prompt instead of the new button", async ({ page }) => {
  await signUp(page, "Wanjiku Kamau", uniqueEmail("recurring-free"));
  await createFirstBusiness(page);

  await nav(page).getByRole("link", { name: "Recurring" }).click();
  await expect(page.getByRole("heading", { name: "Recurring", exact: true })).toBeVisible();
  await expect(main(page).getByText("Recurring invoices are a Pro feature.")).toBeVisible();
  await expect(main(page).getByRole("link", { name: "New recurring invoice" })).toHaveCount(0);
  await expect(main(page).getByText("No recurring invoices yet.")).toBeVisible();
});

test("pro account creates, pauses, resumes and ends a schedule", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, "Wanjiku Kamau", uniqueEmail("recurring-pro"));
  await createFirstBusiness(page);
  await upgradeToPro(page);

  await page.goto("/");
  await nav(page).getByRole("link", { name: "Recurring" }).click();
  await main(page).getByRole("link", { name: "New recurring invoice" }).first().click();
  await waitUntilInteractive(page, "Start schedule");
  await addClient(page);
  await expect(page.getByText(/^Next invoices: /)).toBeVisible();

  await field(page, "Description").fill("Retainer for {month} {year}");
  await field(page, "Unit price").fill("20000");
  await page.getByRole("button", { name: "Start schedule" }).click();

  await expect(page.getByRole("heading", { name: "Njeri Wambui" })).toBeVisible();
  await expect(main(page).getByText("Active", { exact: true })).toBeVisible();
  await expect(main(page).getByText("Nothing yet.")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(main(page).getByText("Paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(main(page).getByText("Active", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "End", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "End this schedule?" });
  await dialog.getByRole("button", { name: "End schedule" }).click();
  await expect(main(page).getByText("Ended", { exact: true })).toBeVisible();
});
