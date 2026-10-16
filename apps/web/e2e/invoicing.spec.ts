import { expect, type Page, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail, waitUntilInteractive } from "./support";

async function startAccount(page: Page) {
  await signUp(page, "Wanjiku Kamau", uniqueEmail("invoicing"));
  await createFirstBusiness(page);
}

const main = (page: Page) => page.getByRole("main");
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });

test("add, edit and archive a client", async ({ page }) => {
  await startAccount(page);
  await page.getByRole("link", { name: "Clients" }).click();
  await expect(page.getByRole("heading", { name: "Your clients." })).toBeVisible();
  await waitUntilInteractive(page, "Add client");

  await page.getByRole("button", { name: "Add client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog.getByText("Client name is required")).toBeVisible();
  await dialog.getByLabel("Client name").fill("Acacia Creative");
  await dialog.getByLabel("Phone").fill("0722 111 222");
  await dialog.getByLabel("Company name · Optional").fill("Acacia Creative Ltd");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog).toBeHidden();
  await expect(main(page).getByText("Acacia Creative Ltd")).toBeVisible();
  await expect(main(page).getByText("+254 722 111 222")).toBeVisible();

  await main(page).getByRole("button", { name: "Edit Acacia Creative" }).click();
  const edit = page.getByRole("dialog", { name: "Edit client" });
  await expect(
    edit.getByText("Existing invoices keep their original client details."),
  ).toBeVisible();
  await edit.getByLabel("Client name").fill("Acacia Studio");
  await edit.getByRole("button", { name: "Save client" }).click();
  await expect(
    main(page)
      .getByRole("paragraph")
      .filter({ hasText: /^Acacia Studio$/ }),
  ).toBeVisible();

  await main(page).getByRole("button", { name: "Archive Acacia Studio" }).click();
  await page
    .getByRole("dialog", { name: "Archive this client?" })
    .getByRole("button", { name: "Archive client" })
    .click();
  await expect(main(page).getByText("No clients yet.")).toBeVisible();
  await main(page).getByRole("link", { name: "Archived" }).click();
  await expect(
    main(page)
      .getByRole("paragraph")
      .filter({ hasText: /^Acacia Studio$/ }),
  ).toBeVisible();
});

test("create an invoice, preview totals, and mark it Ready", async ({ page }) => {
  await startAccount(page);
  await page.getByRole("link", { name: "Create invoice" }).click();
  await expect(page.getByRole("heading", { name: "Create invoice" })).toBeVisible();
  await waitUntilInteractive(page, "Mark as Ready");

  // Payment details from onboarding were skipped, so instructions start empty.
  await expect(page.getByText("10 of 10 invoices left this month")).toBeVisible();

  // Add a client without leaving the editor.
  await page.getByRole("button", { name: "New client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByLabel("Client name").fill("Njeri Wambui");
  await dialog.getByLabel("Phone").fill("0711 000 111");
  await dialog.getByLabel("Company name · Optional").fill("Kijani Collective");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(field(page, "Client")).toHaveValue(/.+/);

  await field(page, "Description").fill("Brand identity");
  await field(page, "Unit price").fill("45000");
  await page.getByRole("button", { name: "Add line item" }).click();
  await field(page, "Description 2").fill("Workshop hours");
  await field(page, "Qty 2").fill("2.5");
  await field(page, "Unit price 2").fill("3000");

  await page.getByLabel("Add discount").check();
  await field(page, "Discount type").selectOption("percentage");
  await field(page, "Discount").fill("10");
  await page.getByLabel("Add tax").check();
  await field(page, "Tax rate (%)").fill("16");

  const preview = page.getByRole("article", { name: "Invoice preview" });
  await expect(preview.getByText("Kijani Collective")).toBeVisible();
  await expect(preview.getByText("52,500.00")).toBeVisible();
  await expect(preview.getByText("−5,250.00")).toBeVisible();
  await expect(preview.getByText("7,560.00")).toBeVisible();
  await expect(preview.getByText("KES 54,810.00")).toBeVisible();

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  await waitUntilInteractive(page, "Mark as Ready");
  await page.getByRole("button", { name: "Mark as Ready" }).click();
  await expect(page.getByRole("heading", { name: "INV-00001" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as Ready" })).toHaveCount(0);

  await page.getByRole("link", { name: "Invoices" }).click();
  const row = main(page).getByRole("row").filter({ hasText: "INV-00001" });
  await expect(row).toContainText("Njeri Wambui");
  await expect(row).toContainText("54,810.00");
  await expect(row).toContainText("Ready");
  await expect(page.getByText("1 of 10 invoices this month")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Invoices used this month" })).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});

test("validation errors and draft deletion", async ({ page }) => {
  await startAccount(page);
  await page.getByRole("link", { name: "Invoices" }).click();
  await expect(page.getByRole("heading", { name: "Every invoice, in view." })).toBeVisible();
  await main(page).getByRole("link", { name: "Create invoice" }).click();
  await waitUntilInteractive(page, "Save draft");

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(field(page, "Client")).toHaveAccessibleDescription("Choose a client");
  await expect(field(page, "Unit price")).toHaveAccessibleDescription("Unit price is required");

  await page.getByRole("button", { name: "New client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByLabel("Client name").fill("Baraka Otieno");
  await dialog.getByLabel("Phone").fill("0700 123 456");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog).toBeHidden();
  await expect(field(page, "Client")).toHaveValue(/.+/);

  await field(page, "Description").fill("Consultation");
  await field(page, "Unit price").fill("1000");
  await page.getByLabel("Add discount").check();
  await field(page, "Discount").fill("5000");
  await expect(page.getByText("The discount is more than the subtotal.")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("The discount cannot be more than the subtotal")).toBeVisible();

  await page.getByLabel("Add discount").uncheck();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("heading", { name: "Draft invoice" })).toBeVisible();
  await waitUntilInteractive(page, "Delete draft");
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page
    .getByRole("dialog", { name: "Delete this draft?" })
    .getByRole("button", { name: "Delete draft" })
    .click();
  await expect(page.getByRole("heading", { name: "Every invoice, in view." })).toBeVisible();
  await expect(main(page).getByText("No invoices yet.")).toBeVisible();
});
