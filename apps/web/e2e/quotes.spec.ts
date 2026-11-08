import { type Browser, expect, type Page, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail, waitUntilInteractive } from "./support";

const main = (page: Page) => page.getByRole("main");
const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });

async function startAccount(page: Page) {
  await signUp(page, "Wanjiku Kamau", uniqueEmail("quotes"));
  await createFirstBusiness(page);
}

/** Opens the editor from the nav, fills one line item and sends. Ends with the share dialog open. */
async function sendNewQuote(page: Page, price: string) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Quotes" })
    .click();
  await expect(page.getByRole("heading", { name: "Quotes", exact: true })).toBeVisible();
  await main(page)
    .getByRole("link", { name: "Create quote" })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Create quote" })).toBeVisible();
  await waitUntilInteractive(page, "Send");

  await page.getByRole("button", { name: "New client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByLabel("Client name").fill("Njeri Wambui");
  await dialog.getByLabel("Phone").fill("0711 000 111");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(field(page, "Client")).toHaveValue(/.+/);

  await field(page, "Description").fill("Logo design");
  await field(page, "Unit price").fill(price);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const share = page.getByRole("dialog", { name: /^Share QT-/ });
  await expect(share).toBeVisible();
  return share;
}

async function readLink(page: Page) {
  const link = await page.getByLabel("Quote link").inputValue();
  expect(link).toContain("/q/");
  return link;
}

async function openAsClient(browser: Browser, link: string) {
  const context = await browser.newContext();
  const client = await context.newPage();
  await client.goto(link);
  await expect(client.getByRole("heading", { name: "Accept this quote" })).toBeVisible();
  await waitUntilInteractive(client, "Accept");
  return client;
}

async function accept(client: Page) {
  await client.getByLabel("Your full name").fill("Njeri Wambui");
  await client.getByLabel("I agree to this quote").check();
  await client.getByRole("button", { name: "Accept", exact: true }).click();
}

test("send a quote, accept it as the client, and convert it to an invoice", async ({
  page,
  browser,
}) => {
  await startAccount(page);
  await sendNewQuote(page, "15000");
  const client = await openAsClient(browser, await readLink(page));

  await accept(client);
  await expect(client.getByText(/Accepted by Njeri Wambui/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /^QT-00001/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accepted by Njeri Wambui" })).toBeVisible();
  await waitUntilInteractive(page, "Convert to invoice");
  await page.getByRole("button", { name: "Convert to invoice" }).click();

  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
  await expect(field(page, "Description")).toHaveValue("Logo design");
  await expect(page.getByRole("link", { name: "QT-00001" })).toBeVisible();
  await expect(main(page).getByText(/From\s+QT-00001/)).toBeVisible();
  await client.context().close();
});

test("decline a quote, then edit and resend it", async ({ page, browser }) => {
  await startAccount(page);
  await sendNewQuote(page, "15000");
  const client = await openAsClient(browser, await readLink(page));

  await client.getByRole("button", { name: "Decline" }).click();
  await client.getByLabel("Reason · Optional").fill("Too expensive");
  await client.getByRole("button", { name: "Send", exact: true }).click();
  await expect(client.getByRole("heading", { name: "Accept this quote" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toBeVisible();
  // Role queries skip the hidden copy Next keeps of the previous page.
  await expect(
    page.getByRole("region", { name: "Client response" }).getByText("“Too expensive”"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Edit and resend" }).click();
  await waitUntilInteractive(page, "Save and send");
  await field(page, "Unit price").fill("12000");
  await page.getByRole("button", { name: "Save and send" }).click();

  await expect(page.getByRole("heading", { name: /^QT-00001/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Declined", exact: true })).toHaveCount(0);
  await expect(main(page).getByText("Sent", { exact: true }).first()).toBeVisible();
  await client.context().close();
});

test("a client with a stale version must reload before accepting", async ({ page, browser }) => {
  await startAccount(page);
  await sendNewQuote(page, "15000");
  const client = await openAsClient(browser, await readLink(page));

  await page.goto(page.url().replace(/\?.*$/, "") + "/edit");
  await waitUntilInteractive(page, "Save changes");
  await field(page, "Unit price").fill("18000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
  await expect(page.getByRole("button", { name: "Convert to invoice" })).toBeVisible();

  await accept(client);
  await expect(client.getByText("This quote was just updated.")).toBeVisible();
  await client.getByRole("button", { name: "Reload" }).click();
  await expect(client.getByText("This quote was just updated.")).toBeHidden();

  await accept(client);
  await expect(client.getByText(/Accepted by Njeri Wambui/)).toBeVisible();
  await client.context().close();
});
