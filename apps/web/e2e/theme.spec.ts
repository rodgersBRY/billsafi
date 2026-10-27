import { expect, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail } from "./support";

const pageColour = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("the dark mode switch in the account menu overrides the device and survives a reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signUp(page, "Achieng Odhiambo", uniqueEmail("theme"));
  await createFirstBusiness(page);
  const light = await pageColour(page);

  const openMenu = () =>
    page.getByLabel("Account menu for Achieng Odhiambo").filter({ visible: true }).click();
  await openMenu();
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await pageColour(page)).toBe("rgb(20, 36, 33)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await pageColour(page)).toBe("rgb(20, 36, 33)");

  // A saved light choice wins over a dark device.
  await page.emulateMedia({ colorScheme: "dark" });
  await openMenu();
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await pageColour(page)).toBe(light);
});
