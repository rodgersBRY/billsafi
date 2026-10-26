import { expect, test } from "@playwright/test";
import { addNairobiMonths } from "@billsafi/domain";
import { createFirstBusiness, signIn, signUp, uniqueEmail } from "./support";

// Everyone else's view of /admin: a real 404 when signed in, sign-in when signed out.

test("a signed-in user who is not an admin gets a real 404 on /admin", async ({ page }) => {
  await signUp(page, "Wanjiru Kamau", uniqueEmail("admin-no"));
  await createFirstBusiness(page);

  // The account menu only offers the admin dashboard to admins.
  await page.getByLabel("Account menu for Wanjiru Kamau").filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin dashboard" })).toHaveCount(0);

  for (const path of ["/admin", "/admin/tenants", "/admin/security"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin modules" })).toHaveCount(0);
  }
});

test("a signed-out visitor on /admin is sent to sign-in like any private page", async ({
  page,
}) => {
  for (const path of ["/admin", "/admin/tenants", "/admin/security"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

// The admin's own view needs an admin account. CI seeds one with a fixed ID
// (apps/api/scripts/seed-browser-admin.mjs) and lists it in ADMIN_USER_IDS before the
// API starts; elsewhere these tests skip unless E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are set.
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("as an admin", () => {
  test.skip(!adminEmail || !adminPassword, "Needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  test("suspends and reactivates a tenant with a reason, and the audit log shows it", async ({
    browser,
    page,
  }) => {
    // A fresh tenant, signed up in its own browser context.
    const tenantEmail = uniqueEmail("admin-target");
    const tenantContext = await browser.newContext();
    await signUp(await tenantContext.newPage(), "Akinyi Odhiambo", tenantEmail);
    await tenantContext.close();

    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).not.toHaveURL(/\/sign-in/);

    await page.goto("/admin/tenants");
    await expect(page.getByRole("heading", { name: "Tenants", level: 1 })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search" }).fill(tenantEmail);
    await expect(page).toHaveURL(/search=/);
    const table = page.getByRole("table", { name: "Tenants" });
    await table.getByRole("link", { name: "Akinyi Odhiambo" }).click();

    await expect(page.getByRole("heading", { name: "Akinyi Odhiambo", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Suspend account" }).click();
    const suspend = page.getByRole("dialog", { name: "Suspend this account?" });
    await suspend.getByLabel(/Reason/).fill("Browser test: suspend with a reason");
    await suspend.getByRole("button", { name: "Suspend account" }).click();
    await expect(suspend).toBeHidden();
    await expect(page.getByText("Account: Suspended").first()).toBeVisible();

    await page.getByRole("link", { name: "Activity & Audit" }).click();
    const activity = page.getByRole("listitem").filter({ hasText: "Suspended account" });
    await expect(activity).toContainText("Browser test: suspend with a reason");
    await expect(activity).toContainText("Success");

    await page.getByRole("button", { name: "Reactivate account" }).click();
    const reactivate = page.getByRole("dialog", { name: "Reactivate this account?" });
    await reactivate.getByLabel(/Reason/).fill("Browser test: reactivate");
    await reactivate.getByRole("button", { name: "Reactivate account" }).click();
    await expect(reactivate).toBeHidden();
    await expect(page.getByText("Account: Active").first()).toBeVisible();
  });

  test("records a manual Pro payment and grants credits for a tenant", async ({
    browser,
    page,
  }) => {
    const tenantEmail = uniqueEmail("admin-billing");
    const tenantContext = await browser.newContext();
    await signUp(await tenantContext.newPage(), "Baraka Mutua", tenantEmail);
    await tenantContext.close();

    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).not.toHaveURL(/\/sign-in/);
    await page.goto(`/admin/tenants?search=${encodeURIComponent(tenantEmail)}`);
    await page
      .getByRole("table", { name: "Tenants" })
      .getByRole("link", { name: "Baraka Mutua" })
      .click();
    await expect(page.getByRole("heading", { name: "Baraka Mutua", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Subscription", exact: true }).click();
    await expect(page).toHaveURL(/tab=subscription/);

    // Two Pro months from now, the rule a new run follows.
    const proUntil = new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    }).format(addNairobiMonths(new Date(), 2));
    const reference = `BT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    await page.getByRole("button", { name: "Record payment" }).click();
    const payment = page.getByRole("dialog", { name: "Record a payment" });
    await payment.getByLabel("Months").fill("2");
    await payment.getByLabel("Amount paid").fill("1040");
    await payment.getByLabel("Method").selectOption("bank_transfer");
    await payment.getByLabel("Reference", { exact: true }).fill(reference);
    await expect(payment).toContainText(`Pro will run until ${proUntil}`);
    await payment.getByLabel(/Reason/).fill("Browser test: paid by bank transfer");
    await payment.getByRole("button", { name: "Record payment" }).click();
    await expect(payment).toBeHidden();
    await expect(
      page.getByRole("status").filter({ hasText: `Pro runs until ${proUntil}` }),
    ).toBeVisible();
    await expect(page.getByText("Subscription: Pro").first()).toBeVisible();
    await expect(page.getByRole("table", { name: "Plan payments" })).toContainText(reference);

    await page.getByRole("button", { name: "Grant credits" }).click();
    const grant = page.getByRole("dialog", { name: "Grant invoice credits" });
    await grant.getByLabel("Invoice credits").fill("25");
    await expect(grant).toContainText("Credits will go from 0 to 25");
    await grant.getByLabel(/Reason/).fill("Browser test: goodwill credits");
    await grant.getByRole("button", { name: "Grant credits" }).click();
    await expect(grant).toBeHidden();
    await expect(page.getByText("25 (bought and granted, not used yet)")).toBeVisible();

    await page.goto(`/admin/subscriptions?tab=payments&search=${encodeURIComponent(tenantEmail)}`);
    const payments = page.getByRole("table", { name: "Plan payments" });
    await expect(payments).toContainText(reference);
    await expect(payments).toContainText("KES 1,040.00");
  });

  test("switches the Overview date range and the figures show their change", async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).not.toHaveURL(/\/sign-in/);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    const ranges = page.getByRole("navigation", { name: "Date range" });
    await expect(ranges.getByRole("link", { name: "30 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await ranges.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(ranges.getByRole("link", { name: "7 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Every tile says how it moved from the period before, in words.
    await expect(page.getByText(/(up|down|no change)( .*)? from /).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tenant growth" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();

    await page.goto("/admin/analytics?range=90d");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feature adoption" })).toBeVisible();
  });
});
