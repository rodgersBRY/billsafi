import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

export const PASSWORD = "correct-horse-battery";

export function uniqueEmail(label: string) {
  return `${label}-${crypto.randomUUID().slice(0, 8)}@example.test`;
}

/** Buttons stay disabled until the page hydrates; wait before typing so input is not lost. */
export async function waitUntilInteractive(page: Page, buttonName: string) {
  await expect(page.getByRole("button", { name: buttonName })).toBeEnabled();
}

export async function signUp(page: Page, name: string, email: string) {
  await page.goto("/sign-up");
  await waitUntilInteractive(page, "Create account");
  await page.getByLabel("Full name").filter({ visible: true }).fill(name);
  await page.getByLabel("Email address").filter({ visible: true }).fill(email);
  await page.getByLabel("Password").filter({ visible: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await acceptWelcome(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await waitUntilInteractive(page, "Continue");
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await waitUntilInteractive(page, "Sign in");
  await page.getByLabel("Email address").filter({ visible: true }).fill(email);
  await page.getByLabel("Password").filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Agrees on the welcome screen new accounts pass through. */
export async function acceptWelcome(page: Page) {
  await expect(page).toHaveURL(/\/welcome\?next=/);
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
  await waitUntilInteractive(page, "Agree and continue");
  await page.getByRole("button", { name: "Agree and continue" }).click();
}

/** Completes the business step and skips payment, ending on the overview. */
export async function createFirstBusiness(page: Page, phone = "0712 345 678") {
  await page.getByLabel("Phone").filter({ visible: true }).fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Go to your overview" }).click();
  await skipIntro(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await skipTour(page);
}

export async function skipIntro(page: Page) {
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

/** Polls Mailpit for the newest message to `to` and returns its plain text. */
export async function latestEmailText(to: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`);
      return ((await message.json()) as { Text: string }).Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email arrived for ${to}`);
}

/** A new account's first Overview visit starts the product tour (D057); skip it. */
export async function skipTour(page: Page) {
  const tour = page.getByRole("dialog", { name: "Welcome to BillSafi" });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).toBeHidden();
}
