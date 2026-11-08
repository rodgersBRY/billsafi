import { expect, type Page, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail, waitUntilInteractive } from "./support";

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

test("save a line item on an invoice and pick it on a quote", async ({ page }) => {
  await signUp(page, "Wanjiku Kamau", uniqueEmail("items"));
  await createFirstBusiness(page);

  await page.getByRole("link", { name: "Create invoice" }).click();
  await waitUntilInteractive(page, "Mark as Ready");
  await addClient(page);
  await field(page, "Description").fill("Brand identity");
  await field(page, "Unit price").fill("45000");
  await main(page).getByRole("button", { name: "Save item 1" }).click();
  await expect(
    page.getByText("“Brand identity” saved. Pick it from the list next time."),
  ).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Save item 1" })).toHaveCount(0);

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Items" }).click();
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toBeVisible();
  const list = main(page).getByRole("region", { name: "Items" });
  await expect(list.getByRole("paragraph").filter({ hasText: /^Brand identity$/ })).toBeVisible();
  await expect(list.getByText("45,000.00")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Quotes" })
    .click();
  await main(page)
    .getByRole("link", { name: "Create quote" })
    .filter({ visible: true })
    .first()
    .click();
  await waitUntilInteractive(page, "Send");
  await field(page, "Description").fill("brand");
  await page.getByRole("option", { name: /Brand identity/ }).click();
  await expect(field(page, "Description")).toHaveValue("Brand identity");
  await expect(field(page, "Unit price")).toHaveValue("45000.00");
  // A picked line is already saved, so it offers no save prompt.
  await expect(
    main(page).getByRole("button", { name: "Save item 1" }).filter({ visible: true }),
  ).toHaveCount(0);
});
