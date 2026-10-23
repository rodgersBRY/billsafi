import { expect, type Page, test } from "@playwright/test";
import {
  createFirstBusiness,
  PASSWORD,
  signUp,
  skipIntro,
  uniqueEmail,
  waitUntilInteractive,
} from "./support";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });

async function openGenerator(page: Page) {
  await page.goto("/free-invoice-generator");
  await expect(page.getByRole("heading", { name: "Free invoice generator" })).toBeVisible();
  await waitUntilInteractive(page, "Save & download");
}

test("the landing page links to the free generator", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create an invoice free" }).first().click();
  await expect(page).toHaveURL(/\/free-invoice-generator$/);
  await expect(page.getByRole("heading", { name: "Free invoice generator" })).toBeVisible();
});

test("typed details survive a reload", async ({ page }) => {
  await openGenerator(page);
  await field(page, "Display name").fill("Wanjiru Designs");
  await field(page, "Client name").fill("Karibu Coffee");
  await field(page, "Description").fill("Logo design");
  // The draft is written shortly after the last change.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("billsafi:guest-invoice:v1")))
    .toContain("Logo design");

  await page.reload();
  await waitUntilInteractive(page, "Save & download");
  await expect(field(page, "Display name")).toHaveValue("Wanjiru Designs");
  await expect(field(page, "Client name")).toHaveValue("Karibu Coffee");
  await expect(field(page, "Description")).toHaveValue("Logo design");
});

test("saving an empty form shows what to fix and asks for no account", async ({ page }) => {
  await openGenerator(page);
  await page.getByRole("button", { name: "Save & download" }).click();
  await expect(page.getByText("Some details need fixing before you can save.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Save your invoice" })).toBeHidden();
});

test("build an invoice, sign up, mark it Ready and download the PDF", async ({ page }) => {
  await openGenerator(page);
  await field(page, "Display name").fill("Wanjiru Designs");
  await field(page, "Email").fill("hello@wanjiru.example.test");
  await field(page, "Phone").fill("0712 345 678");
  await field(page, "Client name").fill("Karibu Coffee");
  await field(page, "Client phone").fill("0722 111 222");
  await field(page, "Description").fill("Brand refresh");
  await field(page, "Unit price").fill("24000");
  await field(page, "Payment instructions").fill("M-Pesa till 123456");

  await page.getByRole("button", { name: "Save & download" }).click();
  const dialog = page.getByRole("dialog", { name: "Save your invoice" });
  await dialog.getByLabel("Full name").fill("Wanjiru Kamau");
  await dialog.getByLabel("Email address").fill(uniqueEmail("generator"));
  await dialog.getByLabel("Password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create account and save" }).click();

  await expect(page).toHaveURL(/\/invoices\/[^/]+\/edit\?from=generator$/);
  await skipIntro(page);
  await expect(
    page.getByText(
      "Your invoice is saved as a draft. Check it, then press Mark as Ready to get your PDF.",
    ),
  ).toBeVisible();
  const preview = page.getByRole("article", { name: "Invoice preview" });
  await expect(preview.getByText("Karibu Coffee")).toBeVisible();
  await expect(preview.getByText("KES 24,000.00")).toBeVisible();

  await waitUntilInteractive(page, "Mark as Ready");
  await page.getByRole("button", { name: "Mark as Ready" }).click();
  await expect(page).toHaveURL(/\/invoices\/[^/?]+$/);
  await expect(page.getByRole("heading", { name: "INV-00001" })).toBeVisible();
  await waitUntilInteractive(page, "Share");
  await page.getByRole("button", { name: "Share" }).click();
  const share = page.getByRole("dialog", { name: "Share INV-00001" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    share.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("INV-00001.pdf");
});

test("signed-in visitors save straight to their existing business", async ({ page }) => {
  await signUp(page, "Achieng Odhiambo", uniqueEmail("generator-signed-in"));
  await createFirstBusiness(page);

  await openGenerator(page);
  await field(page, "Display name").fill("Ignored Name");
  await field(page, "Email").fill("ignored@example.test");
  await field(page, "Phone").fill("0712 345 678");
  await field(page, "Client name").fill("Karibu Coffee");
  await field(page, "Client phone").fill("0722 111 222");
  await field(page, "Description").fill("Brand refresh");
  await field(page, "Unit price").fill("24000");
  await page.getByRole("button", { name: "Save & download" }).click();

  await expect(page).toHaveURL(/\/invoices\/[^/]+\/edit\?from=generator&existing=1$/);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("The business details you typed weren't used.")).toBeVisible();
});
