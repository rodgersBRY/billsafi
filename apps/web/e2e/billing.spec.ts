import { expect, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail, waitUntilInteractive } from "./support";

// The API runs with the fake M-Pesa provider (MPESA_ENV=fake): a request
// succeeds a few seconds after it is sent, and the page finds out by polling.
test("upgrade to Pro with M-Pesa, then cancel and keep it", async ({ page }) => {
  test.setTimeout(90_000);
  await signUp(page, "Wanjiku Kamau", uniqueEmail("billing"));
  await createFirstBusiness(page);

  await page.getByLabel("Account menu for Wanjiku Kamau").filter({ visible: true }).click();
  // Free accounts see an Upgrade to Pro button in place of the Billing link.
  await page.getByRole("link", { name: "Upgrade to Pro" }).click();
  await expect(page.getByRole("heading", { name: "One plan. All your businesses." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upgrade to Pro" })).toBeVisible();
  await waitUntilInteractive(page, "Continue with M-Pesa");

  await page.getByRole("button", { name: "Continue with M-Pesa" }).click();
  // Prefilled from the business phone.
  await expect(page.getByLabel("M-Pesa phone number")).toHaveValue("0712 345 678");
  await page.getByRole("button", { name: "Send payment request" }).click();
  await expect(
    page.getByRole("heading", { name: "Waiting for payment confirmation" }),
  ).toBeVisible();

  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("heading", { name: "Keep Pro going" })).toBeVisible();
  await expect(page.getByText("0 of 100 invoices this Pro month")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pro, one month" })).toBeVisible();

  await waitUntilInteractive(page, "Cancel Pro");
  await page.getByRole("button", { name: "Cancel Pro" }).click();
  await expect(page.getByText(/Cancelled\. Pro stays active until/)).toBeVisible();
  await page.getByRole("button", { name: "Keep Pro" }).click();
  await expect(page.getByText(/Active until/)).toBeVisible();
});
