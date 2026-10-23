import { expect, type Page, test } from "@playwright/test";
import { signUp, skipIntro, uniqueEmail, waitUntilInteractive } from "./support";

/** Onboarding without payment details, stopping on the Overview before the tour is touched. */
async function reachOverview(page: Page) {
  await signUp(page, "Njeri Mwangi", uniqueEmail("tour"));
  await page.getByLabel("Phone").filter({ visible: true }).fill("0712 345 678");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Go to your overview" }).click();
  await skipIntro(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

const tourDialog = (page: Page) => page.locator(".driver-popover[role=dialog]");

test("a new account takes the tour once and it stays done after a reload", async ({ page }) => {
  await reachOverview(page);

  const tour = tourDialog(page);
  await expect(tour).toHaveAccessibleName("Welcome to BillSafi");
  await tour.getByRole("button", { name: "Show me around" }).click();
  await expect(tour).toHaveAccessibleName("Your money at a glance");
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAccessibleName("Create an invoice");
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAccessibleName("Invoices and clients");
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour).toHaveAccessibleName("Your monthly allowance");
  await tour.getByRole("button", { name: "Next" }).click();

  // The account menu closes the tour; payment details were skipped, so it points to Settings.
  await expect(tour).toHaveAccessibleName("Your account menu");
  await expect(tour.getByText("add your M-Pesa, Till, Paybill or bank details")).toBeVisible();
  await expect(tour.getByText("6 of 6")).toBeVisible();
  await expect(tour.getByRole("button", { name: "Skip tour" })).toBeHidden();
  await tour.getByRole("button", { name: "Done" }).click();
  await expect(tour).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Get set up" })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(tour).toBeHidden();
});

test("a skipped tour can be replayed from the account menu", async ({ page }) => {
  await reachOverview(page);

  const tour = tourDialog(page);
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).toBeHidden();

  const takeTour = async () => {
    await page.getByLabel("Account menu for Njeri Mwangi").filter({ visible: true }).click();
    await page.getByRole("link", { name: "Take the tour" }).click();
  };

  // From the Overview itself, twice in a row, without a reload.
  for (let round = 0; round < 2; round++) {
    await takeTour();
    await expect(tour).toHaveAccessibleName("Welcome to BillSafi");
    await page.keyboard.press("Escape");
    await expect(tour).toBeHidden();
  }

  // From another page it opens the Overview and drops the replay flag.
  await page.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await takeTour();
  await expect(tour).toHaveAccessibleName("Welcome to BillSafi");
  await expect(page).toHaveURL(/\/overview$/);
  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
});

test("the floating setup checklist follows the account, minimises and can be hidden", async ({
  page,
}) => {
  await reachOverview(page);
  await tourDialog(page).getByRole("button", { name: "Skip tour" }).click();

  const checklist = page.getByRole("region", { name: "Get set up" });
  await expect(checklist.getByText("0 of 5 done")).toBeVisible();
  await expect(checklist.getByRole("link", { name: "Add payment instructions" })).toHaveAttribute(
    "href",
    /\/settings\?tab=payment$/,
  );

  // On other pages it shrinks to a pill and still ticks steps off.
  await checklist.getByRole("link", { name: "Add a client" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await waitUntilInteractive(page, "Add client");
  await page.getByRole("button", { name: "Add client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByLabel("Client name").fill("Karibu Coffee");
  await dialog.getByLabel("Phone").fill("0722 111 222");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog).toBeHidden();
  const launcher = page.getByRole("button", { name: "Get set up, 1 of 5 done" });
  await expect(launcher).toBeVisible();
  await expect(checklist).toBeHidden();

  // Minimising on the Overview is remembered in this browser.
  await page.getByRole("link", { name: "Overview" }).click();
  await checklist.getByRole("button", { name: "Minimise setup checklist" }).click();
  await expect(launcher).toBeVisible();
  await page.reload();
  await expect(launcher).toBeVisible();
  await launcher.click();

  await checklist.getByRole("button", { name: "Hide setup checklist" }).click();
  await expect(checklist).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(checklist).toBeHidden();
  await expect(launcher).toBeHidden();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sidebar steps show as a centred card", async ({ page }) => {
    await reachOverview(page);

    const tour = tourDialog(page);
    await tour.getByRole("button", { name: "Show me around" }).click();
    await tour.getByRole("button", { name: "Next" }).click();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour).toHaveAccessibleName("Invoices and clients");
    await expect(tour.getByText("Open the menu at the top left")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  });
});
