import { expect, type Page, test } from "@playwright/test";
import { platformSettingDefaults } from "@billsafi/contracts";
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

  // Settings are platform-wide, so each test puts its setting back, pass or fail.
  // Puts a setting back to its default if a failed test left it changed. Skipped when it is
  // already the default, since admin writes are limited to 10 a minute.
  async function restoreSetting(page: Page, key: string, value: unknown) {
    const response = await page.request.get("/api/v1/admin/settings");
    const { settings } = (await response.json()) as {
      settings: { key: string; isDefault: boolean }[];
    };
    if (settings.find((setting) => setting.key === key)?.isDefault) return;
    await page.request.put(`/api/v1/admin/settings/${key}`, {
      data: { value, reason: "Browser test: restore the default" },
    });
  }

  async function editSetting(page: Page, title: string) {
    await page.goto("/admin/settings");
    await page.getByRole("region", { name: title }).getByRole("button", { name: "Edit" }).click();
    return page.getByRole("dialog", { name: title });
  }

  test("creates a support case from the tenant page, adds a note and resolves it", async ({
    browser,
    page,
  }) => {
    const tenantEmail = uniqueEmail("admin-support");
    const tenantContext = await browser.newContext();
    await signUp(await tenantContext.newPage(), "Chebet Rotich", tenantEmail);
    await tenantContext.close();

    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).not.toHaveURL(/\/sign-in/);
    await page.goto(`/admin/tenants?search=${encodeURIComponent(tenantEmail)}`);
    await page
      .getByRole("table", { name: "Tenants" })
      .getByRole("link", { name: "Chebet Rotich" })
      .click();
    await page
      .getByRole("navigation", { name: "Account sections" })
      .getByRole("link", { name: "Support" })
      .click();
    await expect(page).toHaveURL(/tab=support/);

    await page.getByRole("button", { name: "New case" }).click();
    const create = page.getByRole("dialog", { name: "New case" });
    await create.getByLabel("Title").fill("Cannot sign in on phone");
    await create.getByLabel("Category").selectOption("sign_in");
    await create.getByLabel("Severity").selectOption("high");
    await create.getByLabel(/Reason/).fill("Browser test: customer wrote in");
    await create.getByRole("button", { name: "Create case" }).click();
    await expect(create).toBeHidden();
    await page
      .getByRole("table", { name: "Account cases" })
      .getByRole("link", { name: "Cannot sign in on phone" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Cannot sign in on phone", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Status: Open").first()).toBeVisible();
    await expect(page.getByText("Category: Sign-in").first()).toBeVisible();

    // Notes are plain text: markup shows as typed, and line breaks stay.
    await page.getByLabel("Add a note", { exact: true }).fill("Tried a reset.\n<b>not bold</b>");
    await page.getByRole("button", { name: "Add note" }).click();
    const timeline = page.getByRole("list").filter({ hasText: "Tried a reset." });
    await expect(timeline).toContainText("<b>not bold</b>");
    await expect(timeline.locator("b")).toHaveCount(0);

    await page.getByRole("button", { name: "Resolve" }).click();
    const resolve = page.getByRole("dialog", { name: "Resolve case" });
    await resolve.getByLabel("How was it resolved?").fill("Reset the password by hand.");
    await resolve.getByLabel(/Reason/).fill("Browser test: fixed");
    await resolve.getByRole("button", { name: "Resolve case" }).click();
    await expect(resolve).toBeHidden();
    await expect(page.getByText("Status: Resolved").first()).toBeVisible();
    await expect(page.getByText("Reset the password by hand.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  });

  test("an announcement shows in the app while it is on, and goes away when it is off", async ({
    browser,
    page,
  }) => {
    const tenantContext = await browser.newContext();
    const tenant = await tenantContext.newPage();
    await signUp(tenant, "Dancan Ouma", uniqueEmail("admin-banner"));
    await createFirstBusiness(tenant);

    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).not.toHaveURL(/\/sign-in/);
    try {
      const dialog = await editSetting(page, "Announcement banner");
      await dialog.getByLabel("Show the banner").check();
      await dialog.getByLabel("Message").fill("Planned maintenance on Sunday at 2am.");
      await expect(dialog.getByRole("region", { name: "Announcement" })).toHaveCount(0);
      await expect(dialog).toContainText("Planned maintenance on Sunday at 2am.");
      await dialog.getByLabel(/Reason/).fill("Browser test: announce maintenance");
      await dialog.getByRole("button", { name: "Save" }).click();
      await expect(dialog).toBeHidden();

      await tenant.reload();
      const banner = tenant.getByRole("region", { name: "Announcement" });
      await expect(banner).toContainText("Planned maintenance on Sunday at 2am.");

      // Dismissing hides it on this device, and it stays hidden after a reload.
      await banner.getByRole("button", { name: "Dismiss announcement" }).click();
      await expect(banner).toBeHidden();
      await tenant.reload();
      await expect(tenant.getByRole("heading", { name: "Overview" })).toBeVisible();
      await expect(banner).toBeHidden();

      const off = await editSetting(page, "Announcement banner");
      await off.getByLabel("Show the banner").uncheck();
      await off.getByLabel(/Reason/).fill("Browser test: maintenance is over");
      await off.getByRole("button", { name: "Save" }).click();
      await expect(off).toBeHidden();
      await tenant.reload();
      await expect(tenant.getByRole("region", { name: "Announcement" })).toHaveCount(0);
    } finally {
      await restoreSetting(page, "announcement", platformSettingDefaults.announcement);
      await tenantContext.close();
    }
  });

  test("closing registration shows the message on the sign-up page until it is reopened", async ({
    browser,
    page,
  }) => {
    // The earlier tests used most of the limit of 10 admin writes a minute.
    test.setTimeout(150_000);
    await page.waitForTimeout(65_000);
    const visitor = await browser.newContext();
    const signUpPage = await visitor.newPage();
    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).not.toHaveURL(/\/sign-in/);
    try {
      const close = await editSetting(page, "Registration");
      await close.getByLabel("Sign-ups are open").uncheck();
      await close.getByLabel("Message shown when closed").fill("We are not taking sign-ups today.");
      await close.getByLabel(/Reason/).fill("Browser test: close sign-ups");
      await close.getByRole("button", { name: "Close sign-ups" }).click();
      await expect(close).toBeHidden();

      await signUpPage.goto("/sign-up");
      await expect(signUpPage.getByText("We are not taking sign-ups today.")).toBeVisible();
      await expect(signUpPage.getByRole("button", { name: "Create account" })).toHaveCount(0);

      const reopen = await editSetting(page, "Registration");
      await reopen.getByLabel("Sign-ups are open").check();
      await reopen.getByLabel(/Reason/).fill("Browser test: reopen sign-ups");
      await reopen.getByRole("button", { name: "Save" }).click();
      await expect(reopen).toBeHidden();

      await signUpPage.goto("/sign-up");
      await expect(signUpPage.getByRole("button", { name: "Create account" })).toBeVisible();
    } finally {
      await restoreSetting(page, "registration", platformSettingDefaults.registration);
      await visitor.close();
    }
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
    // Every headline figure says how it moved from the period before, in words.
    await expect(page.getByText(/(up|down|no change).*last period/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account growth" })).toBeVisible();
    // Items show under a heading; with nothing to do there is one quiet line instead.
    await expect(
      page
        .getByRole("heading", { name: "Needs attention" })
        .or(page.getByText("Nothing needs you right now.")),
    ).toBeVisible();

    await page.goto("/admin/analytics?range=90d");
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Feature adoption" })).toBeVisible();
  });
});
