import type { INestApplication } from "@nestjs/common";
import { and, type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import { addNairobiMonths, FREE_PLAN, PRO_PLAN } from "@billsafi/domain";
import request from "supertest";
import { BillingService } from "../src/billing/billing.service.js";
import type { FakeMpesaProvider } from "../src/billing/mpesa/fake.provider.js";
import { DATABASE } from "../src/database/database.module.js";
import {
  type CapturingMailer,
  createBusiness,
  createClient,
  createTestApp,
  signUp,
} from "./support/app.js";

const CALLBACK = "/api/v1/billing/mpesa/callback/e2e-callback-token-0123456789";
const DAY_MS = 24 * 60 * 60 * 1000;

const draftBody = (clientId: string) => ({
  clientId,
  issueDate: "2026-10-16",
  dueDate: "2026-10-30",
  items: [{ description: "Design work", quantity: "1", unitPrice: "1000" }],
});

describe("billing", () => {
  let app: INestApplication;
  let mpesa: FakeMpesaProvider;
  let mailer: CapturingMailer;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;

  beforeAll(async () => {
    ({ app, mpesa, mailer } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const { cookie, email } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const path = `/api/v1/businesses/${businessId}/invoices`;
    const issue = async (status = 200) => {
      const draft = await api()
        .post(path)
        .set("Cookie", cookie)
        .send(draftBody(clientId))
        .expect(201);
      return api().post(`${path}/${draft.body.id}/ready`).set("Cookie", cookie).expect(status);
    };
    const checkout = (purpose = "pro_month", phone = "0708 374 149") =>
      api().post("/api/v1/billing/checkout").set("Cookie", cookie).send({ purpose, phone });
    const overview = async () =>
      (await api().get("/api/v1/billing").set("Cookie", cookie).expect(200)).body;
    const userId = async () => {
      const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
      return user!.id;
    };
    return { cookie, email, issue, checkout, overview, userId };
  }

  function callback(
    checkoutRequestId: string,
    result: { code?: number; receipt?: string; amount?: number; description?: string } = {},
  ) {
    const code = result.code ?? 0;
    return api()
      .post(CALLBACK)
      .send({
        Body: {
          stkCallback: {
            MerchantRequestID: "29115-34620561-1",
            CheckoutRequestID: checkoutRequestId,
            ResultCode: code,
            ResultDesc:
              result.description ??
              (code === 0
                ? "The service request is processed successfully."
                : "Request cancelled by user"),
            ...(code === 0 && {
              CallbackMetadata: {
                Item: [
                  { Name: "Amount", Value: result.amount ?? 500 },
                  { Name: "MpesaReceiptNumber", Value: result.receipt ?? receipt() },
                  { Name: "TransactionDate", Value: 20261017102115 },
                  { Name: "PhoneNumber", Value: 254708374149 },
                ],
              },
            }),
          },
        },
      })
      .expect(200);
  }

  const receipt = () => `TK${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  /** Starts a checkout and confirms it through the callback. */
  async function pay(account: Awaited<ReturnType<typeof setup>>, purpose = "pro_month") {
    const started = await account.checkout(purpose).expect(201);
    const { checkoutRequestId } = mpesa.last()!;
    await callback(checkoutRequestId, { amount: purpose === "pro_month" ? 500 : 250 });
    return started.body.id as string;
  }

  /** Moves the account's paid access so it ends `endsInMs` from now. */
  async function shiftAccess(userId: string, endsInMs: number, paidMonths = 1) {
    const end = new Date(Date.now() + endsInMs);
    const anchorAt = addNairobiMonths(end, -paidMonths);
    await db()
      .update(schema.subscriptions)
      .set({ anchorAt, paidMonths, paidUntil: end })
      .where(eq(schema.subscriptions.userId, userId));
  }

  it("sends an STK Push to the Paybill and waits for confirmation", async () => {
    const account = await setup();
    const response = await account.checkout().expect(201);
    expect(response.body).toMatchObject({
      purpose: "pro_month",
      amount: "500.00",
      status: "pending",
    });
    expect(mpesa.last()!.request).toMatchObject({ amount: 500, phone: "254708374149" });

    const overview = await account.overview();
    expect(overview.subscription.status).toBe("free");
    expect(overview.pendingPayment.id).toBe(response.body.id);

    const [stored] = await db()
      .select()
      .from(schema.subscriptionPayments)
      .where(eq(schema.subscriptionPayments.id, response.body.id));
    expect(stored).toMatchObject({ priceUsd: "4.00", usdKesRate: "125.000000" });
  });

  it("prices plans in USD and charges KES at the current rate", async () => {
    const account = await setup();
    expect((await account.overview()).prices).toEqual({
      usd: { pro_month: "4.00", invoice_credits: "2.00" },
      kes: { pro_month: "500.00", invoice_credits: "250.00" },
      usdKesRate: "125",
      rateUpdatedAt: null,
    });
  });

  it("activates Pro once and carries Free usage into the first period", async () => {
    const account = await setup();
    for (let index = 0; index < 7; index++) await account.issue();

    const started = await account.checkout().expect(201);
    const { checkoutRequestId } = mpesa.last()!;
    const code = receipt();
    await callback(checkoutRequestId, { receipt: code });
    // Daraja can repeat a callback; the second one changes nothing.
    await callback(checkoutRequestId, { receipt: code });

    const overview = await account.overview();
    expect(overview.subscription.status).toBe("active");
    expect(overview.usage).toMatchObject({ plan: "pro", limit: PRO_PLAN.invoiceLimit, used: 7 });
    const paidUntil = new Date(overview.subscription.paidUntil);
    expect(paidUntil.getTime()).toBe(
      addNairobiMonths(new Date(overview.usage.periodStart), 1).getTime(),
    );
    expect(overview.payments).toHaveLength(1);
    expect(overview.payments[0]).toMatchObject({
      id: started.body.id,
      status: "succeeded",
      receipt: code,
    });

    await account.issue();
    expect((await account.overview()).usage.used).toBe(8);
  });

  it("never applies the same M-Pesa receipt twice", async () => {
    const first = await setup();
    const second = await setup();
    const code = receipt();
    await first.checkout().expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { receipt: code });
    await second.checkout().expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { receipt: code });

    const overview = await second.overview();
    expect(overview.subscription.status).toBe("free");
    expect(overview.payments[0]).toMatchObject({
      status: "failed",
      resultDescription: "This M-Pesa transaction was already used",
    });
  });

  it("records failed and mismatched payments without granting Pro", async () => {
    const account = await setup();
    await account.checkout().expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { code: 1032 });
    await account.checkout().expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { amount: 1 });

    const overview = await account.overview();
    expect(overview.subscription.status).toBe("free");
    expect(
      overview.payments.map((payment: { resultDescription: string }) => payment.resultDescription),
    ).toEqual(["Paid KES 1, expected KES 500", "Request cancelled by user"]);
  });

  it("refuses a second checkout while a prompt is still waiting", async () => {
    const account = await setup();
    await account.checkout().expect(201);
    const response = await account.checkout().expect(409);
    expect(response.body.code).toBe("PAYMENT_PENDING");
  });

  it("asks M-Pesa for the result when the callback is late", async () => {
    const account = await setup();
    const started = await account.checkout().expect(201);
    const { checkoutRequestId } = mpesa.last()!;
    await db()
      .update(schema.subscriptionPayments)
      .set({ createdAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.subscriptionPayments.id, started.body.id));

    const pending = await api()
      .get(`/api/v1/billing/payments/${started.body.id}`)
      .set("Cookie", account.cookie)
      .expect(200);
    expect(pending.body.status).toBe("pending");

    mpesa.settle(checkoutRequestId, { state: "succeeded" });
    const settled = await api()
      .get(`/api/v1/billing/payments/${started.body.id}`)
      .set("Cookie", account.cookie)
      .expect(200);
    expect(settled.body).toMatchObject({ status: "succeeded", receipt: null });

    // The late callback still fills in the receipt without extending access.
    const code = receipt();
    await callback(checkoutRequestId, { receipt: code });
    const overview = await account.overview();
    expect(overview.payments[0].receipt).toBe(code);
    expect(overview.payments).toHaveLength(1);
  });

  it("extends from the current expiry on early renewal without moving the period", async () => {
    const account = await setup();
    await pay(account);
    const before = await account.overview();
    await pay(account);
    const after = await account.overview();

    expect(after.usage.periodStart).toBe(before.usage.periodStart);
    expect(after.usage.periodEnd).toBe(before.usage.periodEnd);
    expect(after.subscription.paidUntil).toBe(
      addNairobiMonths(new Date(before.usage.periodStart), 2).toISOString(),
    );
  });

  it("stores paid_until as the domain rule after activation, renewal and restart", async () => {
    const account = await setup();
    const userId = await account.userId();
    const stored = async () => {
      const [row] = await db()
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, userId));
      expect(row!.paidUntil).toEqual(addNairobiMonths(row!.anchorAt!, row!.paidMonths));
      return row!;
    };
    await pay(account);
    expect((await stored()).paidMonths).toBe(1);
    await pay(account);
    const renewed = await stored();
    expect(renewed.paidMonths).toBe(2);
    expect((await account.overview()).subscription.paidUntil).toBe(
      renewed.paidUntil!.toISOString(),
    );
    await shiftAccess(userId, -60_000);
    await pay(account);
    expect((await stored()).paidMonths).toBe(1);
  });

  it("starts a new anniversary after expiry and carries only Free usage", async () => {
    const account = await setup();
    const userId = await account.userId();
    await pay(account);
    for (let index = 0; index < 3; index++) await account.issue();

    // Pro ended a minute ago: its 3 invoices still count on Free this month (D044).
    await shiftAccess(userId, -60_000);
    expect((await account.overview()).usage).toMatchObject({ plan: "free", used: 3 });
    for (let index = 0; index < 2; index++) await account.issue();

    const beforePay = Date.now();
    await pay(account);
    const overview = await account.overview();
    expect(new Date(overview.usage.periodStart).getTime()).toBeGreaterThanOrEqual(beforePay - 1000);
    expect(overview.usage).toMatchObject({ plan: "pro", used: 2, limit: PRO_PLAN.invoiceLimit });
  });

  it("lets Free and Pro accounts continue past the cap with credits", async () => {
    const account = await setup();
    for (let index = 0; index < FREE_PLAN.invoiceLimit; index++) await account.issue();
    const refused = await account.issue(409);
    expect(refused.body).toMatchObject({
      code: "ALLOWANCE_REACHED",
      usage: { plan: "free", limit: FREE_PLAN.invoiceLimit },
    });

    await account.checkout("invoice_credits").expect(201);
    expect(mpesa.last()!.request.amount).toBe(250);
    await callback(mpesa.last()!.checkoutRequestId, { amount: 250 });
    expect((await account.overview()).usage.credits).toBe(50);

    await account.issue();
    const overview = await account.overview();
    expect(overview.usage).toMatchObject({ used: 10, credits: 49 });
    expect(overview.payments[0]).toMatchObject({ purpose: "invoice_credits", creditsGranted: 50 });
  });

  it("cancels at the end of paid access and undoes before expiry", async () => {
    const account = await setup();
    await api().post("/api/v1/billing/cancel").set("Cookie", account.cookie).expect(409);
    await pay(account);

    const cancelled = await api()
      .post("/api/v1/billing/cancel")
      .set("Cookie", account.cookie)
      .expect(200);
    expect(cancelled.body.subscription.status).toBe("cancelled");
    expect(cancelled.body.subscription.paidUntil).toBeTruthy();
    expect(cancelled.body.usage.plan).toBe("pro");

    const resumed = await api()
      .post("/api/v1/billing/resume")
      .set("Cookie", account.cookie)
      .expect(200);
    expect(resumed.body.subscription).toMatchObject({ status: "active", cancelledAt: null });
    expect(resumed.body.subscription.paidUntil).toBe(cancelled.body.subscription.paidUntil);

    await api().post("/api/v1/billing/cancel").set("Cookie", account.cookie).expect(200);
    await shiftAccess(await account.userId(), -60_000);
    await api().post("/api/v1/billing/resume").set("Cookie", account.cookie).expect(409);
    expect((await account.overview()).subscription.status).toBe("free");
  });

  it("stores the reason given when cancelling and rejects unknown reasons", async () => {
    const account = await setup();
    await pay(account);
    const cancel = (body: object) =>
      api().post("/api/v1/billing/cancel").set("Cookie", account.cookie).send(body);
    await cancel({ reason: "bored" }).expect(400);
    await cancel({ note: "x".repeat(501) }).expect(400);
    await cancel({ reason: "missing_feature", note: "  Need recurring invoices  " }).expect(200);

    const [event] = await db()
      .select({ details: schema.subscriptionEvents.details })
      .from(schema.subscriptionEvents)
      .innerJoin(
        schema.subscriptions,
        eq(schema.subscriptions.id, schema.subscriptionEvents.subscriptionId),
      )
      .where(
        and(
          eq(schema.subscriptions.userId, await account.userId()),
          eq(schema.subscriptionEvents.kind, "cancelled"),
        ),
      );
    expect(event!.details).toMatchObject({
      reason: "missing_feature",
      note: "Need recurring invoices",
    });
  });

  it("emails one renewal reminder per expiry, and none while cancelled", async () => {
    const billing = app.get(BillingService);
    const active = await setup();
    const cancelled = await setup();
    await pay(active);
    await pay(cancelled);
    await api().post("/api/v1/billing/cancel").set("Cookie", cancelled.cookie).expect(200);
    await shiftAccess(await active.userId(), 2 * DAY_MS);
    await shiftAccess(await cancelled.userId(), 2 * DAY_MS);

    await billing.sendReminders();
    await billing.sendReminders();
    // Sign-up also sends a welcome email; count only renewal reminders.
    const reminder = "Your BillSafi Pro ends soon";
    const reminders = mailer.sent.filter((message) => message.subject === reminder);
    expect(reminders.filter((message) => message.to === active.email)).toHaveLength(1);
    expect(reminders.some((message) => message.to === cancelled.email)).toBe(false);
    expect((await active.overview()).subscription.renewalDue).toBe(true);
  });

  it("emails one receipt when a payment succeeds, even if the callback repeats", async () => {
    const account = await setup();
    await account.checkout().expect(201);
    const { checkoutRequestId } = mpesa.last()!;
    const code = receipt();
    await callback(checkoutRequestId, { receipt: code });
    await callback(checkoutRequestId, { receipt: code });

    const receipts = mailer.sent.filter(
      (message) => message.to === account.email && message.subject.startsWith("Payment received"),
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.subject).toBe("Payment received: 1 month of Pro");
    expect(receipts[0]!.text).toContain("KES 500.00");
    expect(receipts[0]!.text).toContain(code);
    expect(receipts[0]!.text).toContain("Pro until");
  });

  it("emails a credit pack receipt that says how many credits were added", async () => {
    const account = await setup();
    await account.checkout("invoice_credits").expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { amount: 250 });
    const email = mailer.lastTo(account.email)!;
    expect(email.subject).toBe("Payment received: 50 invoice credits");
    expect(email.text).toContain("KES 250.00");
  });

  it("emails one receipt when the status query settles the payment first", async () => {
    const account = await setup();
    const started = await account.checkout().expect(201);
    const { checkoutRequestId } = mpesa.last()!;
    await db()
      .update(schema.subscriptionPayments)
      .set({ createdAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.subscriptionPayments.id, started.body.id));
    mpesa.settle(checkoutRequestId, { state: "succeeded" });
    const poll = () =>
      api()
        .get(`/api/v1/billing/payments/${started.body.id}`)
        .set("Cookie", account.cookie)
        .expect(200);
    await poll();
    await poll();
    await callback(checkoutRequestId, { receipt: receipt() });

    const receipts = mailer.sent.filter(
      (message) => message.to === account.email && message.subject.startsWith("Payment received"),
    );
    expect(receipts).toHaveLength(1);
  });

  it("emails once when a payment fails, but not when the person cancels the prompt", async () => {
    const account = await setup();
    const failedSubject = "Your BillSafi payment didn't go through";
    const failures = () =>
      mailer.sent.filter(
        (message) => message.to === account.email && message.subject === failedSubject,
      );

    await account.checkout().expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { code: 1032 });
    expect(failures()).toHaveLength(0);

    await account.checkout().expect(201);
    const { checkoutRequestId } = mpesa.last()!;
    const declined = { code: 1, description: "The balance is insufficient" };
    await callback(checkoutRequestId, declined);
    await callback(checkoutRequestId, declined);
    expect(failures()).toHaveLength(1);
    expect(failures()[0]!.text).toContain("you haven't been charged");
  });

  it("emails when a payment is abandoned and the background sweep expires it", async () => {
    const account = await setup();
    const started = await account.checkout().expect(201);
    await db()
      .update(schema.subscriptionPayments)
      .set({ createdAt: new Date(Date.now() - 2 * DAY_MS) })
      .where(eq(schema.subscriptionPayments.id, started.body.id));
    const billing = app.get(BillingService);
    await billing.sweepPending();
    await billing.sweepPending();

    const failures = mailer.sent.filter(
      (message) =>
        message.to === account.email &&
        message.subject === "Your BillSafi payment didn't go through",
    );
    expect(failures).toHaveLength(1);
  });

  it("emails once when Pro has ended, only soon after, and not for old lapses", async () => {
    const billing = app.get(BillingService);
    const recent = await setup();
    const old = await setup();
    const renewed = await setup();
    await pay(recent);
    await pay(old);
    await pay(renewed);
    await shiftAccess(await recent.userId(), -60 * 60 * 1000);
    await shiftAccess(await old.userId(), -10 * DAY_MS);
    await shiftAccess(await renewed.userId(), 2 * DAY_MS);

    await billing.sendReminders();
    await billing.sendReminders();
    const ended = (email: string) =>
      mailer.sent.filter(
        (message) => message.to === email && message.subject === "Your BillSafi Pro has ended",
      );
    expect(ended(recent.email)).toHaveLength(1);
    expect(ended(recent.email)[0]!.text).toContain("Free plan");
    expect(ended(old.email)).toHaveLength(0);
    expect(ended(renewed.email)).toHaveLength(0);
  });

  it("emails a Free account once per month when it uses its last invoice", async () => {
    const account = await setup();
    const limitEmails = () =>
      mailer.sent.filter(
        (message) =>
          message.to === account.email &&
          message.subject === "You've used all your Free invoices this month",
      );
    for (let index = 0; index < FREE_PLAN.invoiceLimit - 1; index++) await account.issue();
    expect(limitEmails()).toHaveLength(0);

    await account.issue();
    expect(limitEmails()).toHaveLength(1);
    expect(limitEmails()[0]!.text).toContain("all 10 invoices");
    expect(limitEmails()[0]!.text).toContain("resets on");

    // The refused 11th invoice and later credit-funded ones send nothing more.
    await account.issue(409);
    await account.checkout("invoice_credits").expect(201);
    await callback(mpesa.last()!.checkoutRequestId, { amount: 250 });
    await account.issue();
    expect(limitEmails()).toHaveLength(1);
  });

  it("does not send the Free limit email to a Pro account at its Pro limit", async () => {
    const account = await setup();
    await pay(account);
    for (let index = 0; index < 3; index++) await account.issue();
    expect(
      mailer.sent.some(
        (message) =>
          message.to === account.email &&
          message.subject === "You've used all your Free invoices this month",
      ),
    ).toBe(false);
  });

  it("rejects callbacks without the secret token", async () => {
    await api().post("/api/v1/billing/mpesa/callback/wrong-token").send({}).expect(404);
  });

  it("keeps billing private to each account", async () => {
    const owner = await setup();
    const other = await setup();
    const started = await owner.checkout().expect(201);
    await api()
      .get(`/api/v1/billing/payments/${started.body.id}`)
      .set("Cookie", other.cookie)
      .expect(404);
    const count = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.subscriptionPayments)
      .where(eq(schema.subscriptionPayments.userId, await other.userId()));
    expect(count[0]!.count).toBe(0);
  });
});
