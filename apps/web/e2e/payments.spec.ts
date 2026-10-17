import { expect, type Page, test } from "@playwright/test";
import { createFirstBusiness, signUp, uniqueEmail, waitUntilInteractive } from "./support";

const field = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true });
const main = (page: Page) => page.getByRole("main");

/** A new account with a Ready KES 50,000 invoice, ending on its details page. */
async function readyInvoice(page: Page) {
  await signUp(page, "Wanjiku Kamau", uniqueEmail("payments"));
  await createFirstBusiness(page);
  await page.getByRole("link", { name: "Create invoice" }).first().click();
  await waitUntilInteractive(page, "Mark as Ready");
  await page.getByRole("button", { name: "New client" }).click();
  const dialog = page.getByRole("dialog", { name: "Add client" });
  await dialog.getByLabel("Client name").fill("Njeri Wambui");
  await dialog.getByLabel("Phone").fill("0711 000 111");
  await dialog.getByLabel("Email · Optional").fill("njeri@example.test");
  await dialog.getByRole("button", { name: "Save client" }).click();
  await expect(dialog).toBeHidden();
  await field(page, "Description").fill("Website build");
  await field(page, "Unit price").fill("50000");
  await page.getByRole("button", { name: "Mark as Ready" }).click();
  await expect(page.getByRole("heading", { name: /INV-00001/ })).toBeVisible();
  await waitUntilInteractive(page, "Record payment");
}

async function recordPayment(page: Page, amount: string, reference?: string) {
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record payment" });
  await dialog.getByLabel("Amount received (KES)").fill(amount);
  if (reference) await dialog.getByLabel("Reference · Optional").fill(reference);
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();
}

test("record, correct and reverse payments, then cancel", async ({ page }) => {
  await readyInvoice(page);
  const balance = page.getByRole("region", { name: "Balance" });

  // The PRD example: 50,000 with 20,000 recorded leaves 30,000, Partially paid.
  await recordPayment(page, "20000", "QK12AB34CD");
  await expect(balance).toContainText("30,000.00");
  await expect(main(page).getByText("Partially paid").first()).toBeVisible();
  await expect(
    main(page).getByText("Client, line items, discount, and tax are locked"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel invoice" })).toHaveCount(0);

  // Over the balance is refused.
  await page.getByRole("button", { name: "Record payment" }).click();
  const over = page.getByRole("dialog", { name: "Record payment" });
  await expect(over.getByLabel("Amount received (KES)")).toHaveValue("30000.00");
  await over.getByLabel("Amount received (KES)").fill("30000.01");
  await over.getByRole("button", { name: "Save payment" }).click();
  await expect(
    over.getByText("The amount is more than the balance due of KES 30000.00"),
  ).toBeVisible();
  await over.getByRole("button", { name: "Cancel" }).click();

  // Correct with a reason and see the history.
  await main(page).getByRole("button", { name: "Correct" }).click();
  const correct = page.getByRole("dialog", { name: "Correct payment" });
  await correct.getByLabel("Amount received (KES)").fill("25000");
  await correct.getByRole("button", { name: "Save correction" }).click();
  await expect(correct.getByText("Reason is required")).toBeVisible();
  await correct.getByLabel("Reason for the correction").fill("Typed the wrong amount");
  await correct.getByRole("button", { name: "Save correction" }).click();
  await expect(correct).toBeHidden();
  await expect(balance).toContainText("25,000.00");
  await main(page).getByText("Corrected · 1 change").click();
  await expect(main(page).getByText("Reason: Typed the wrong amount")).toBeVisible();

  // Reverse: kept and marked, invoice back to Ready but still locked.
  await main(page).getByRole("button", { name: "Reverse" }).click();
  const reverse = page.getByRole("dialog", { name: "Reverse this payment?" });
  await reverse.getByLabel("Reason for the reversal").fill("Recorded on the wrong invoice");
  await reverse.getByRole("button", { name: "Reverse payment" }).click();
  await expect(reverse).toBeHidden();
  await expect(main(page).getByText("Reversed", { exact: true })).toBeVisible();
  await expect(balance).toContainText("50,000.00");
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // Notes stay editable while locked.
  await field(page, "Note on the invoice · Optional").fill("Balance due by end of month");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(main(page).getByText("Notes saved.")).toBeVisible();

  // With no effective payments left, cancellation is allowed.
  await page.getByRole("button", { name: "Cancel invoice" }).click();
  await page
    .getByRole("dialog", { name: "Cancel this invoice?" })
    .getByRole("button", { name: "Cancel invoice" })
    .click();
  await expect(
    main(page).getByText("This invoice is cancelled and retained for your records."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);
});

test("share a link that clients open without an account", async ({ page, browser }) => {
  await readyInvoice(page);
  await recordPayment(page, "20000");

  await page.getByRole("button", { name: "Share" }).click();
  const share = page.getByRole("dialog", { name: "Share INV-00001" });
  await share.getByRole("button", { name: "Create link" }).click();
  const linkField = share.getByLabel(/Invoice link/);
  await expect(linkField).toHaveValue(/\/i\/[A-Za-z0-9_-]{43}$/);
  const firstLink = await linkField.inputValue();

  const whatsapp = share.getByRole("link", { name: "WhatsApp" });
  await expect(whatsapp).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/254711000111\?text=Hi%20Njeri%20Wambui/,
  );
  const email = share.getByRole("link", { name: "Email" });
  await expect(email).toHaveAttribute(
    "href",
    /^mailto:njeri@example\.test\?subject=Invoice%20INV-00001/,
  );

  // A client with no account and no cookies.
  const client = await browser.newPage();
  await client.goto(firstLink);
  const invoice = client.getByRole("article", { name: "Invoice preview" });
  await expect(invoice.getByText("INV-00001")).toBeVisible();
  await expect(invoice.getByText("Partially paid")).toBeVisible();
  await expect(invoice.getByText("KES 30,000.00")).toBeVisible();
  const [download] = await Promise.all([
    client.waitForEvent("download"),
    client.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("INV-00001.pdf");

  // Replacing the link makes the old one unavailable.
  await share.getByRole("button", { name: "Create new link" }).click();
  await expect(linkField).not.toHaveValue(firstLink);
  await client.goto(firstLink);
  await expect(client.getByRole("heading", { name: "This invoice isn't available" })).toBeVisible();
  await client.close();
});

test("dashboard totals follow payments", async ({ page }) => {
  await readyInvoice(page);
  await recordPayment(page, "12500");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Overview" })
    .click();
  const metrics = main(page).getByRole("definition");
  await expect(main(page).getByText("Outstanding")).toBeVisible();
  await expect(metrics.filter({ hasText: "37,500.00" })).toHaveCount(1);
  await expect(metrics.filter({ hasText: "12,500.00" })).toHaveCount(1);
  await expect(main(page).getByRole("row").filter({ hasText: "INV-00001" })).toContainText(
    "Partially paid",
  );
});
