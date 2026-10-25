import type { INestApplication } from "@nestjs/common";
import { asc, type DatabaseConnection, eq, schema } from "@billsafi/db";
import { addNairobiMonths, CREDIT_PACK, nairobiDate } from "@billsafi/domain";
import request from "supertest";
import { AuditService } from "../src/audit/audit.service.js";
import { DATABASE } from "../src/database/database.module.js";
import { signUp, uniqueEmail } from "./support/app.js";

/**
 * Super admin phase 3 (subscriptions). Runs inside admin.e2e-spec.ts on its app and admin:
 * the admin role sync there rewrites users.role for the whole database on every start, so
 * a second spec file with its own admin would be demoted mid-run.
 */
export interface SubscriptionSuiteContext {
  app: () => INestApplication;
  adminCookie: () => string;
  adminId: () => string;
  /** Signs up an account with a business and client and makes `ready` invoices Ready. */
  seedAccount: (
    label: string,
    ready: number,
  ) => Promise<{ cookie: string; email: string; issue: (count: number) => Promise<void> }>;
  payPro: (cookie: string) => Promise<string>;
  userId: (email: string) => Promise<string>;
}

const REASON = "Paid by bank transfer, confirmed";
const today = () => nairobiDate(new Date());

export function subscriptionSuite(ctx: SubscriptionSuiteContext) {
  const api = () => request(ctx.app().getHttpServer());
  const db = () => ctx.app().get<DatabaseConnection>(DATABASE).db;
  const post = (path: string, body: object, cookie = ctx.adminCookie()) =>
    api().post(`/api/v1/admin/${path}`).set("Cookie", cookie).send(body);
  const get = (path: string) => api().get(`/api/v1/admin/${path}`).set("Cookie", ctx.adminCookie());
  const auditFor = (targetId: string) =>
    db()
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.targetId, targetId))
      .orderBy(asc(schema.auditLogs.occurredAt));
  const subscriptionOf = async (userId: string) =>
    (
      await db().select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId))
    )[0];
  const paymentsOf = (userId: string) =>
    db()
      .select()
      .from(schema.subscriptionPayments)
      .where(eq(schema.subscriptionPayments.userId, userId))
      .orderBy(asc(schema.subscriptionPayments.createdAt));
  const eventsOf = async (userId: string) => {
    const subscription = await subscriptionOf(userId);
    if (!subscription) return [];
    return db()
      .select()
      .from(schema.subscriptionEvents)
      .where(eq(schema.subscriptionEvents.subscriptionId, subscription.id))
      .orderBy(asc(schema.subscriptionEvents.createdAt));
  };
  /** The stored end date always equals the domain rule (step 1 of the plan). */
  async function expectPaidUntilParity(userId: string) {
    const row = await subscriptionOf(userId);
    if (!row?.anchorAt) {
      expect(row?.paidUntil ?? null).toBeNull();
      return row;
    }
    expect(row.paidUntil).toEqual(addNairobiMonths(row.anchorAt, row.paidMonths));
    return row;
  }
  async function newAccount(label = "admin-sub") {
    const account = await ctx.seedAccount(label, 0);
    return { ...account, id: await ctx.userId(account.email) };
  }
  const billingOf = async (cookie: string) =>
    (await api().get("/api/v1/billing").set("Cookie", cookie).expect(200)).body;
  const reference = () => `REF-${crypto.randomUUID().slice(0, 8)}`;
  const proPayment = (overrides: object = {}) => ({
    purpose: "pro_month",
    months: 3,
    amount: "12.00",
    currency: "USD",
    method: "bank_transfer",
    reference: reference(),
    paidAt: today(),
    note: "Invoice INV-204 from their accountant",
    reason: REASON,
    ...overrides,
  });

  describe("subscriptions: manual payments", () => {
    it("records a Pro payment for several months, audited, with the event and paid_until", async () => {
      const account = await newAccount();
      const body = proPayment();
      const response = await post(`tenants/${account.id}/payments`, body)
        .set("x-request-id", "e2e-manual-1")
        .expect(201);
      expect(response.body).toMatchObject({
        paymentId: expect.any(String),
        replayed: false,
        subscription: { plan: { code: "pro" }, status: "pro", paidMonths: 3, credits: 0 },
      });
      const row = await expectPaidUntilParity(account.id);
      expect(response.body.subscription.paidUntil).toBe(row!.paidUntil!.toISOString());

      const [payment] = await paymentsOf(account.id);
      expect(payment).toMatchObject({
        id: response.body.paymentId,
        provider: "manual",
        status: "succeeded",
        purpose: "pro_month",
        quantity: 3,
        amount: "12.00",
        currency: "USD",
        phone: null,
        method: "bank_transfer",
        externalReference: body.reference,
        recordedBy: ctx.adminId(),
        note: body.note,
        grantedUntil: row!.paidUntil,
      });
      expect(nairobiDate(payment!.paidAt!)).toBe(body.paidAt);

      const events = await eventsOf(account.id);
      expect(events).toEqual([
        expect.objectContaining({
          kind: "activated",
          paymentId: payment!.id,
          details: expect.objectContaining({ source: "manual", months: 3 }),
        }),
      ]);

      const [audit] = await auditFor(account.id);
      expect(audit).toMatchObject({
        actorUserId: ctx.adminId(),
        action: "tenant.record_payment",
        targetType: "account",
        outcome: "success",
        reason: REASON,
        requestId: "e2e-manual-1",
        changes: {
          payment: expect.objectContaining({ amount: "12.00", currency: "USD", quantity: 3 }),
          paidMonths: { from: 0, to: 3 },
          paidUntil: { from: null, to: row!.paidUntil!.toISOString() },
          credits: { from: 0, to: 0 },
        },
      });
      // The note stays out of the audit log.
      expect(JSON.stringify(audit!.changes)).not.toContain("INV-204");
    });

    it("extends an active M-Pesa Pro from its expiry without moving the anchor", async () => {
      const account = await newAccount();
      await ctx.payPro(account.cookie);
      const before = await expectPaidUntilParity(account.id);
      await post(`tenants/${account.id}/payments`, proPayment({ months: 2 })).expect(201);
      const after = await expectPaidUntilParity(account.id);
      expect(after!.anchorAt).toEqual(before!.anchorAt);
      expect(after!.paidMonths).toBe(3);
      const manual = (await paymentsOf(account.id)).at(-1)!;
      expect(manual.grantedFrom).toEqual(before!.paidUntil);
      expect((await eventsOf(account.id)).at(-1)!.kind).toBe("renewed");
    });

    it("adds credit packs to the balance", async () => {
      const account = await newAccount();
      const response = await post(`tenants/${account.id}/payments`, {
        ...proPayment({ purpose: "invoice_credits", amount: "520", currency: "KES" }),
        months: undefined,
        packs: 2,
      }).expect(201);
      expect(response.body.subscription).toMatchObject({ credits: 2 * CREDIT_PACK.invoices });
      expect((await billingOf(account.cookie)).usage.credits).toBe(2 * CREDIT_PACK.invoices);
      const [payment] = await paymentsOf(account.id);
      expect(payment).toMatchObject({ amount: "520.00", creditsGranted: 100, quantity: 2 });
      expect((await eventsOf(account.id)).at(-1)).toMatchObject({
        kind: "credits_added",
        details: expect.objectContaining({ source: "manual", credits: 100, packs: 2 }),
      });
      await expectPaidUntilParity(account.id);
    });

    it.each([
      ["months 0", { months: 0 }, "months"],
      ["months 13", { months: 13 }, "months"],
      ["a zero amount", { amount: "0" }, "amount"],
      ["three decimals", { amount: "1.234" }, "amount"],
      ["a number amount", { amount: 12 }, "amount"],
      ["another currency", { currency: "EUR" }, "currency"],
      ["an unknown method", { method: "cheque" }, "method"],
      ["a blank reference", { reference: "  " }, "reference"],
      ["a long reference", { reference: "R".repeat(101) }, "reference"],
      ["a future date", { paidAt: nairobiDate(new Date(Date.now() + 2 * 86_400_000)) }, "paidAt"],
      ["a datetime", { paidAt: new Date().toISOString() }, "paidAt"],
      ["a long note", { note: "n".repeat(501) }, "note"],
      ["no reason", { reason: undefined }, "reason"],
      ["an unknown purpose", { purpose: "gift" }, "purpose"],
    ])("answers 400 for %s and records nothing", async (_label, change, path) => {
      const account = await newAccount();
      const response = await post(`tenants/${account.id}/payments`, proPayment(change)).expect(400);
      expect(response.body.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );
      expect(await paymentsOf(account.id)).toEqual([]);
      expect(await auditFor(account.id)).toEqual([]);
    });

    it("answers 400 for packs above 10", async () => {
      const account = await newAccount();
      await post(`tenants/${account.id}/payments`, {
        ...proPayment({ purpose: "invoice_credits" }),
        packs: 11,
      }).expect(400);
    });

    it("refuses a payment dated before the account existed, and audits the refusal", async () => {
      const account = await newAccount();
      const response = await post(
        `tenants/${account.id}/payments`,
        proPayment({ paidAt: "2020-01-01" }),
      ).expect(400);
      expect(response.body.issues).toEqual([expect.objectContaining({ path: "paidAt" })]);
      expect(await auditFor(account.id)).toEqual([
        expect.objectContaining({
          outcome: "failure",
          changes: { error: expect.objectContaining({ status: 400 }) },
        }),
      ]);
    });

    it("refuses a reference already used with the same method, in any letter case", async () => {
      const first = await newAccount();
      const second = await newAccount();
      const ref = reference();
      await post(`tenants/${first.id}/payments`, proPayment({ reference: ref })).expect(201);
      const duplicate = await post(
        `tenants/${second.id}/payments`,
        proPayment({ reference: ref.toLowerCase() }),
      ).expect(409);
      expect(duplicate.body.code).toBe("DUPLICATE_REFERENCE");
      expect(await paymentsOf(second.id)).toEqual([]);
      expect((await auditFor(second.id)).at(-1)).toMatchObject({
        outcome: "failure",
        changes: { error: expect.objectContaining({ code: "DUPLICATE_REFERENCE" }) },
      });
      // The same reference through another method is a different payment.
      await post(
        `tenants/${second.id}/payments`,
        proPayment({ reference: ref, method: "cash" }),
      ).expect(201);
    });

    it("replays a retried request with the same Idempotency-Key and refuses a changed one", async () => {
      const account = await newAccount();
      const key = `idem-${crypto.randomUUID()}`;
      const body = proPayment();
      const first = await post(`tenants/${account.id}/payments`, body)
        .set("Idempotency-Key", key)
        .expect(201);
      const again = await post(`tenants/${account.id}/payments`, body)
        .set("Idempotency-Key", key)
        .expect(201);
      expect(again.body).toEqual({ ...first.body, replayed: true });
      expect(await paymentsOf(account.id)).toHaveLength(1);
      expect((await subscriptionOf(account.id))!.paidMonths).toBe(3);

      const changed = await post(`tenants/${account.id}/payments`, { ...body, months: 4 })
        .set("Idempotency-Key", key)
        .expect(409);
      expect(changed.body.code).toBe("IDEMPOTENCY_MISMATCH");
      expect(await paymentsOf(account.id)).toHaveLength(1);
      expect((await auditFor(account.id)).map((row) => row.outcome)).toEqual([
        "success",
        "failure",
      ]);

      await post(`tenants/${account.id}/payments`, proPayment())
        .set("Idempotency-Key", "k".repeat(101))
        .expect(400);
      await post(`tenants/${account.id}/payments`, proPayment())
        .set("Idempotency-Key", "  ")
        .expect(400);
    });

    it("refuses to record a payment for your own account", async () => {
      const response = await post(`tenants/${ctx.adminId()}/payments`, proPayment()).expect(409);
      expect(response.body.code).toBe("CANNOT_GRANT_SELF");
    });

    it("answers 404 for an unknown or malformed account, recording unknown ones", async () => {
      const unknown = crypto.randomUUID();
      await post(`tenants/${unknown}/payments`, proPayment()).expect(404);
      await post("tenants/not-a-uuid/payments", proPayment()).expect(404);
      expect(await auditFor(unknown)).toEqual([
        expect.objectContaining({
          outcome: "failure",
          changes: { error: expect.objectContaining({ status: 404 }) },
        }),
      ]);
    });

    it("answers 404 to a signed-out visitor or a non-admin", async () => {
      const account = await newAccount();
      const { cookie } = await signUp(ctx.app(), uniqueEmail("admin-sub-stranger"));
      await api()
        .post(`/api/v1/admin/tenants/${account.id}/payments`)
        .send(proPayment())
        .expect(404);
      await post(`tenants/${account.id}/payments`, proPayment(), cookie).expect(404);
      expect(await paymentsOf(account.id)).toEqual([]);
    });

    it("rolls back when the audit row can't be written, leaving the key free for a retry", async () => {
      const account = await newAccount();
      const audit = ctx.app().get(AuditService);
      const original = audit.record.bind(audit);
      const spy = vi
        .spyOn(audit, "record")
        .mockImplementation((entry, executor) =>
          executor ? Promise.reject(new Error("audit insert failed")) : original(entry),
        );
      const key = `idem-${crypto.randomUUID()}`;
      const body = proPayment();
      try {
        await post(`tenants/${account.id}/payments`, body).set("Idempotency-Key", key).expect(500);
      } finally {
        spy.mockRestore();
      }
      expect(await paymentsOf(account.id)).toEqual([]);
      expect((await subscriptionOf(account.id))?.paidMonths ?? 0).toBe(0);
      await expectPaidUntilParity(account.id);
      expect(await auditFor(account.id)).toEqual([
        expect.objectContaining({ action: "tenant.record_payment", outcome: "failure" }),
      ]);
      const retry = await post(`tenants/${account.id}/payments`, body)
        .set("Idempotency-Key", key)
        .expect(201);
      expect(retry.body.replayed).toBe(false);
    });

    it("works on a suspended account", async () => {
      const account = await newAccount();
      await db().update(schema.users).set({ banned: true }).where(eq(schema.users.id, account.id));
      await post(`tenants/${account.id}/payments`, proPayment({ months: 1 })).expect(201);
    });

    it("lists manual payments in tenant detail and billing with method and reference", async () => {
      const account = await newAccount();
      const body = proPayment();
      await post(`tenants/${account.id}/payments`, body).expect(201);
      const detail = await get(`tenants/${account.id}`).expect(200);
      expect(detail.body.subscription.payments).toEqual([
        expect.objectContaining({
          provider: "manual",
          method: "bank_transfer",
          amount: "12.00",
          currency: "USD",
          quantity: 3,
          phone: null,
          externalReference: body.reference,
          paidOn: body.paidAt,
          recordedBy: { id: ctx.adminId(), email: expect.any(String) },
          note: body.note,
        }),
      ]);
    });
  });

  describe("subscriptions: grants", () => {
    const grantsOf = (userId: string) =>
      db()
        .select()
        .from(schema.accountGrants)
        .where(eq(schema.accountGrants.userId, userId))
        .orderBy(asc(schema.accountGrants.createdAt));

    it("grants Pro months on Free as a new run, audited, never as a payment", async () => {
      const account = await newAccount();
      const response = await post(`tenants/${account.id}/grants`, {
        kind: "pro_months",
        quantity: 2,
        reason: "Apology for the outage",
      }).expect(201);
      expect(response.body).toMatchObject({
        grantId: expect.any(String),
        replayed: false,
        subscription: { plan: { code: "pro" }, paidMonths: 2 },
      });
      const row = await expectPaidUntilParity(account.id);
      expect(await grantsOf(account.id)).toEqual([
        expect.objectContaining({
          id: response.body.grantId,
          kind: "pro_months",
          quantity: 2,
          reason: "Apology for the outage",
          grantedBy: ctx.adminId(),
          grantedUntil: row!.paidUntil,
        }),
      ]);
      expect(await paymentsOf(account.id)).toEqual([]);
      expect(await eventsOf(account.id)).toEqual([
        expect.objectContaining({
          kind: "granted",
          grantId: response.body.grantId,
          details: expect.objectContaining({ grant: "pro_months", quantity: 2, renews: false }),
        }),
      ]);
      expect((await auditFor(account.id)).at(-1)).toMatchObject({
        action: "tenant.grant",
        outcome: "success",
        changes: {
          grant: { id: response.body.grantId, kind: "pro_months", quantity: 2 },
          paidMonths: { from: 0, to: 2 },
        },
      });
      expect((await billingOf(account.cookie)).subscription.status).toBe("active");
    });

    it("adds granted months after a paid run and keeps the account's cancellation", async () => {
      const account = await newAccount();
      await ctx.payPro(account.cookie);
      await api().post("/api/v1/billing/cancel").set("Cookie", account.cookie).expect(200);
      const before = await expectPaidUntilParity(account.id);
      await post(`tenants/${account.id}/grants`, {
        kind: "pro_months",
        quantity: 1,
        reason: "Loyalty month",
      }).expect(201);
      const after = await expectPaidUntilParity(account.id);
      expect(after!.paidMonths).toBe(2);
      expect(after!.anchorAt).toEqual(before!.anchorAt);
      expect(after!.cancelledAt).toEqual(before!.cancelledAt);
      expect((await grantsOf(account.id))[0]!.grantedFrom).toEqual(before!.paidUntil);
    });

    it("counts granted credits with bought ones and spends them after the plan allowance", async () => {
      const account = await ctx.seedAccount("admin-sub-credits", 10);
      const id = await ctx.userId(account.email);
      await post(`tenants/${id}/payments`, {
        ...proPayment({ purpose: "invoice_credits", amount: "260", currency: "KES" }),
        packs: 1,
      }).expect(201);
      const response = await post(`tenants/${id}/grants`, {
        kind: "invoice_credits",
        quantity: 3,
        reason: "Goodwill credits",
      }).expect(201);
      expect(response.body.subscription.credits).toBe(CREDIT_PACK.invoices + 3);
      await account.issue(2);
      expect((await billingOf(account.cookie)).usage).toMatchObject({
        used: 10,
        credits: CREDIT_PACK.invoices + 1,
      });
      const detail = await get(`tenants/${id}`).expect(200);
      expect(detail.body.usage.credits).toBe(CREDIT_PACK.invoices + 1);
    });

    it.each([
      [{ kind: "pro_months", quantity: 0 }],
      [{ kind: "pro_months", quantity: 13 }],
      [{ kind: "invoice_credits", quantity: 501 }],
      [{ kind: "invoice_credits", quantity: "5" }],
      [{ kind: "trial", quantity: 1 }],
      [{ kind: "pro_months", quantity: 1, reason: "abc" }],
    ])("answers 400 for %o", async (body) => {
      const account = await newAccount();
      await post(`tenants/${account.id}/grants`, { reason: "Goodwill credits", ...body }).expect(
        400,
      );
      expect(await grantsOf(account.id)).toEqual([]);
      expect(await auditFor(account.id)).toEqual([]);
    });

    it("refuses to grant to your own account and answers 404 for unknown accounts", async () => {
      const self = await post(`tenants/${ctx.adminId()}/grants`, {
        kind: "invoice_credits",
        quantity: 5,
        reason: "Just testing this",
      }).expect(409);
      expect(self.body.code).toBe("CANNOT_GRANT_SELF");
      expect(await grantsOf(ctx.adminId())).toEqual([]);
      await post(`tenants/${crypto.randomUUID()}/grants`, {
        kind: "invoice_credits",
        quantity: 5,
        reason: "Goodwill credits",
      }).expect(404);
    });

    it("replays a grant sent twice with one Idempotency-Key", async () => {
      const account = await newAccount();
      const key = `idem-${crypto.randomUUID()}`;
      const body = { kind: "invoice_credits", quantity: 7, reason: "Goodwill credits" };
      const first = await post(`tenants/${account.id}/grants`, body)
        .set("Idempotency-Key", key)
        .expect(201);
      const again = await post(`tenants/${account.id}/grants`, body)
        .set("Idempotency-Key", key)
        .expect(201);
      expect(again.body).toEqual({ ...first.body, replayed: true });
      expect(await grantsOf(account.id)).toHaveLength(1);
      // A key is per action: reusing it for a payment is a different request.
      const other = await post(`tenants/${account.id}/payments`, proPayment())
        .set("Idempotency-Key", key)
        .expect(409);
      expect(other.body.code).toBe("IDEMPOTENCY_MISMATCH");
    });

    it("rolls a grant back when the audit row can't be written", async () => {
      const account = await newAccount();
      const audit = ctx.app().get(AuditService);
      const original = audit.record.bind(audit);
      const spy = vi
        .spyOn(audit, "record")
        .mockImplementation((entry, executor) =>
          executor ? Promise.reject(new Error("audit insert failed")) : original(entry),
        );
      try {
        await post(`tenants/${account.id}/grants`, {
          kind: "pro_months",
          quantity: 1,
          reason: "Loyalty month",
        }).expect(500);
      } finally {
        spy.mockRestore();
      }
      expect(await grantsOf(account.id)).toEqual([]);
      expect((await subscriptionOf(account.id))?.anchorAt ?? null).toBeNull();
      expect(await auditFor(account.id)).toEqual([
        expect.objectContaining({ action: "tenant.grant", outcome: "failure" }),
      ]);
    });
  });
}
