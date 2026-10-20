import { expect, test } from "@playwright/test";
import {
  createFirstBusiness,
  signUp,
  skipIntro,
  uniqueEmail,
  waitUntilInteractive,
} from "./support";

test("new account sets up a business, payment details and lands on the overview", async ({
  page,
}) => {
  const email = uniqueEmail("onboarding");
  await signUp(page, "Wanjiku Kamau", email);

  // Business step is prefilled from the account.
  await expect(page.getByRole("heading", { name: "How should clients know you?" })).toBeVisible();
  await expect(page.getByLabel("Display name").filter({ visible: true })).toHaveValue(
    "Wanjiku Kamau",
  );
  await expect(page.getByLabel("Contact email").filter({ visible: true })).toHaveValue(email);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter a Kenyan mobile number")).toBeVisible();

  await page.getByRole("button", { name: "Business", exact: true }).click();
  await page.getByLabel("Display name").filter({ visible: true }).fill("Wanjiku Designs");
  await page.getByLabel("Phone").filter({ visible: true }).fill("0712 345 678");
  await page.getByRole("button", { name: "Continue" }).click();

  // Payment step prefills the personal M-Pesa number from the profile phone.
  await expect(page.getByRole("heading", { name: "Tell clients how to pay you." })).toBeVisible();
  await expect(page.getByLabel("M-Pesa number").filter({ visible: true })).toHaveValue(
    "0712 345 678",
  );
  await page.getByLabel("Payment method").filter({ visible: true }).selectOption("bank_transfer");
  await expect(page.getByLabel("M-Pesa number").filter({ visible: true })).toBeHidden();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page.getByText("Bank transfer instructions is required")).toBeVisible();
  await page
    .getByLabel("Bank transfer details")
    .filter({ visible: true })
    .fill("Equity Bank, account 0123456789");
  await page.getByRole("button", { name: "Finish setup" }).click();

  await expect(page.getByRole("heading", { name: "You're ready to invoice." })).toBeVisible();
  await page.getByRole("button", { name: "Go to your overview" }).click();

  // The post-login intro plays once and can be skipped.
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Wanjiku Designs")).toBeVisible();

  // A refresh does not replay the intro.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip" })).toBeHidden();
});

test("an account can add and switch between businesses", async ({ page }) => {
  await signUp(page, "Otieno Ouma", uniqueEmail("multi"));
  await createFirstBusiness(page);

  await page.getByRole("link", { name: "Add a business" }).click();
  await expect(page.getByRole("heading", { name: "Add another business" })).toBeVisible();
  await waitUntilInteractive(page, "Continue");
  await page.getByLabel("Display name").filter({ visible: true }).fill("Ouma Photography");
  await page.getByLabel("Phone").filter({ visible: true }).fill("0110 000 000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Go to your overview" }).click();
  await skipIntro(page);

  const switcher = page.getByLabel("Business").filter({ visible: true });
  await expect(switcher).toHaveValue(/.+/);
  await expect(switcher.locator("option")).toHaveText(["Otieno Ouma", "Ouma Photography"]);
  await expect(
    page.getByRole("main").getByText("Ouma Photography").filter({ visible: true }),
  ).toBeVisible();

  await switcher.selectOption({ label: "Otieno Ouma" });
  await expect(
    page.getByRole("main").getByText("Otieno Ouma").filter({ visible: true }),
  ).toBeVisible();
});

test("one account cannot open another account's business", async ({ page, browser }) => {
  await signUp(page, "Account A", uniqueEmail("owner"));
  await createFirstBusiness(page);
  const ownedUrl = page.url();

  const other = await browser.newPage();
  await signUp(other, "Account B", uniqueEmail("stranger"));
  await createFirstBusiness(other, "0722 000 000");
  // Streaming sends the 200 header before the ownership check, so assert on content.
  await other.goto(ownedUrl);
  await expect(other.getByRole("heading", { name: /We couldn.t find that page/ })).toBeVisible();
  await expect(other.getByText("Account A")).toHaveCount(0);
  await other.close();
});
