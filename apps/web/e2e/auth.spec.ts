import { expect, test } from "@playwright/test";
import {
  createFirstBusiness,
  latestEmailText,
  PASSWORD,
  signIn,
  signUp,
  skipIntro,
  uniqueEmail,
  waitUntilInteractive,
} from "./support";

test("signed-out visitors land on the marketing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good work.");
});

test("signed-out visitors are sent to sign in from app pages", async ({ page }) => {
  await page.goto("/billing");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("continue with Google sends the visitor to Google's consent screen", async ({ page }) => {
  // Never reach Google from tests; the outgoing request is enough.
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.goto("/sign-in");
  await waitUntilInteractive(page, "Continue with Google");

  const [request] = await Promise.all([
    page.waitForRequest((request) => request.url().startsWith("https://accounts.google.com/")),
    page.getByRole("button", { name: "Continue with Google" }).click(),
  ]);

  const url = new URL(request.url());
  expect(url.searchParams.get("redirect_uri")).toBe(
    "http://localhost:3000/api/v1/auth/callback/google",
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
});

test("explains a Google sign-in for an email that already has a password", async ({ page }) => {
  await page.goto("/sign-in?error=account_not_linked");
  await expect(page.getByText("Sign in with your password instead.")).toBeVisible();
});

test("sign out and sign back in", async ({ page }) => {
  const email = uniqueEmail("signin");
  await signUp(page, "Achieng Odhiambo", email);
  await createFirstBusiness(page);

  await page.getByLabel("Account menu for Achieng Odhiambo").filter({ visible: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, email, "wrong-password");
  await expect(page.getByText("That email and password don't match.")).toBeVisible();

  await signIn(page, email);
  await skipIntro(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("signing in again after signing out does not leave the button spinning", async ({ page }) => {
  const email = uniqueEmail("again");
  await signUp(page, "Achieng Odhiambo", email);
  await createFirstBusiness(page);

  // Visited pages stay alive in the background; reuse the same sign-in page twice.
  for (let round = 0; round < 2; round++) {
    await page.getByLabel("Account menu for Achieng Odhiambo").filter({ visible: true }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await waitUntilInteractive(page, "Sign in");
    await page.getByLabel("Email address").filter({ visible: true }).fill(email);
    await page.getByLabel("Password").filter({ visible: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await skipIntro(page);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  }
});

test("reset a forgotten password through the emailed link", async ({ page }) => {
  const email = uniqueEmail("reset");
  await signUp(page, "Kamau Njoroge", email);
  await createFirstBusiness(page);
  await page.context().clearCookies();

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await waitUntilInteractive(page, "Send reset link");
  await page.getByLabel("Email address").filter({ visible: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const text = await latestEmailText(email);
  const link = /(https?:\/\/\S+\/reset-password\/\S+)/.exec(text)?.[1];
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await waitUntilInteractive(page, "Update password");

  await page
    .getByLabel("New password", { exact: true })
    .filter({ visible: true })
    .fill("a-brand-new-passphrase");
  await page
    .getByLabel("Confirm new password")
    .filter({ visible: true })
    .fill("a-brand-new-passphrase");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

  // The same link cannot be reused.
  await page.goto(link!);
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();

  await signIn(page, email, "a-brand-new-passphrase");
  await skipIntro(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("the account menu sits in the sidebar and closes on an outside click or Escape", async ({
  page,
}) => {
  await signUp(page, "Achieng Odhiambo", uniqueEmail("menu"));
  await createFirstBusiness(page);

  const trigger = page.getByLabel("Account menu for Achieng Odhiambo").filter({ visible: true });
  await expect(page.getByRole("complementary").getByLabel(/Account menu/)).toBeVisible();

  const signOut = page.getByRole("button", { name: "Sign out" });
  await trigger.click();
  await expect(signOut).toBeVisible();
  await page.getByRole("heading", { name: "Overview" }).click();
  await expect(signOut).toBeHidden();

  await trigger.click();
  await expect(signOut).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(signOut).toBeHidden();
});

test("the password field can show and hide what was typed", async ({ page }) => {
  await page.goto("/sign-in");
  await waitUntilInteractive(page, "Sign in");
  const password = page.getByLabel("Password").filter({ visible: true });
  await password.fill("correct-horse-battery");
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("correct-horse-battery");

  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});
