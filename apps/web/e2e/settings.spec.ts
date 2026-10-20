import { expect, test } from "@playwright/test";
import {
  createFirstBusiness,
  PASSWORD,
  signIn,
  signUp,
  uniqueEmail,
  waitUntilInteractive,
} from "./support";

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("edit business settings, upload a logo and change the password", async ({ page }) => {
  const email = uniqueEmail("settings");
  await signUp(page, "Wanjiku Kamau", email);
  await createFirstBusiness(page);

  await page.getByLabel("Account menu for Wanjiku Kamau").filter({ visible: true }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await waitUntilInteractive(page, "Save changes");

  // Profile and logo.
  await page.getByLabel("Display name").fill("Wanjiku Studio");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();
  await page.getByLabel("Upload logo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByRole("img", { name: "Wanjiku Studio logo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace logo" })).toBeVisible();

  // Payment instructions.
  await page.getByRole("tab", { name: "Payment instructions" }).click();
  await page.getByLabel("Payment method").selectOption("mpesa_till");
  await page.getByLabel("Till number").fill("123456");
  await page.getByRole("button", { name: "Save instructions" }).click();
  await expect(page.getByText("Instructions saved.")).toBeVisible();

  // Invoice defaults.
  await page.getByRole("tab", { name: "Invoice defaults" }).click();
  await page.getByLabel("Default payment terms (days)").fill("30");
  await page.getByRole("button", { name: "Save defaults" }).click();
  await expect(page.getByText("Defaults saved.")).toBeVisible();

  // Account: a wrong current password is refused, then the change works.
  await page.getByRole("tab", { name: "Account" }).click();
  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel("New password").fill("a-brand-new-passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("That isn't your current password")).toBeVisible();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, email, "a-brand-new-passphrase");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
