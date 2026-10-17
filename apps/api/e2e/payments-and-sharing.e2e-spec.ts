import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, schema, sql } from "@tallynest/db";
import { nairobiDate } from "@tallynest/domain";
import request from "supertest";
import { DATABASE } from "../src/database/database.module.js";
import { createBusiness, createClient, createTestApp, signUp } from "./support/app.js";

const today = nairobiDate(new Date());

describe("payments, cancellation, sharing and dashboard", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  /** An account with a Ready KES 50,000 invoice (the PRD example). */
  async function issued(overrides: Record<string, unknown> = {}) {
    const { cookie } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const base = `/api/v1/businesses/${businessId}/invoices`;
    const draft = await api()
      .post(base)
      .set("Cookie", cookie)
      .send({
        clientId,
        issueDate: today,
        dueDate: today,
        items: [{ description: "Website build", quantity: "1", unitPrice: "50000" }],
        ...overrides,
      })
      .expect(201);
    const path = `${base}/${draft.body.id}`;
    await api().post(`${path}/ready`).set("Cookie", cookie).expect(200);
    const pay = (body: Record<string, unknown>) =>
      api()
        .post(`${path}/payments`)
        .set("Cookie", cookie)
        .send({ method: "mpesa", paymentDate: today, ...body });
    return { cookie, businessId, clientId, base, path, invoiceId: draft.body.id as string, pay };
  }

  describe("recording payments", () => {
    it("moves Ready to Partially paid to Paid and tracks the balance", async () => {
      const { pay } = await issued();

      const partial = await pay({ amount: "20000", reference: "QK12AB34CD" }).expect(201);
      expect(partial.body).toMatchObject({
        status: "partially_paid",
        paymentsReceived: "20000.00",
        balanceDue: "30000.00",
        financialsLocked: true,
      });

      const full = await pay({ amount: "30000" }).expect(201);
      expect(full.body).toMatchObject({ status: "paid", balanceDue: "0.00" });
    });

    it("rejects payments above the balance, in the future, or on drafts", async () => {
      const { cookie, base, clientId, pay } = await issued();
      const over = await pay({ amount: "50000.01" }).expect(400);
      expect(over.body.issues[0]).toMatchObject({ path: "amount" });

      const future = await pay({ amount: "100", paymentDate: "2999-01-01" }).expect(400);
      expect(future.body.issues[0].path).toBe("paymentDate");

      const draft = await api()
        .post(base)
        .set("Cookie", cookie)
        .send({ clientId, issueDate: today, dueDate: today, items: [] })
        .expect(201);
      await api()
        .post(`${base}/${draft.body.id}/payments`)
        .set("Cookie", cookie)
        .send({ amount: "10", method: "mpesa", paymentDate: today })
        .expect(409);
    });

    it("locks financial fields after payment but keeps notes editable", async () => {
      const { cookie, path, clientId, pay } = await issued();
      await pay({ amount: "1000" }).expect(201);

      await api()
        .put(path)
        .set("Cookie", cookie)
        .send({
          clientId,
          issueDate: today,
          dueDate: today,
          items: [{ description: "Changed", quantity: "1", unitPrice: "1" }],
        })
        .expect(409);
      const notes = await api()
        .patch(`${path}/notes`)
        .set("Cookie", cookie)
        .send({ notes: "Thanks for the deposit" })
        .expect(200);
      expect(notes.body.notes).toBe("Thanks for the deposit");
    });
  });

  describe("corrections and reversals", () => {
    it("corrects with a reason, keeps history, and lets Paid fall back", async () => {
      const { cookie, path, pay } = await issued();
      await pay({ amount: "50000" }).expect(201);
      const [payment] = (await api().get(`${path}/payments`).set("Cookie", cookie)).body;

      await api()
        .post(`${path}/payments/${payment.id}/correct`)
        .set("Cookie", cookie)
        .send({ amount: "45000", method: "mpesa", paymentDate: today })
        .expect(400);
      const corrected = await api()
        .post(`${path}/payments/${payment.id}/correct`)
        .set("Cookie", cookie)
        .send({ amount: "45000", method: "bank_transfer", paymentDate: today, reason: "Typo" })
        .expect(200);
      expect(corrected.body).toMatchObject({ status: "partially_paid", balanceDue: "5000.00" });

      await api()
        .post(`${path}/payments/${payment.id}/correct`)
        .set("Cookie", cookie)
        .send({ amount: "50000.01", method: "mpesa", paymentDate: today, reason: "Too much" })
        .expect(400);

      const history = await api().get(`${path}/payments`).set("Cookie", cookie).expect(200);
      expect(history.body[0]).toMatchObject({ amount: "45000.00", method: "bank_transfer" });
      expect(history.body[0].changes).toEqual([
        expect.objectContaining({
          kind: "correction",
          reason: "Typo",
          previousValues: expect.objectContaining({ amount: "50000.00", method: "mpesa" }),
          newValues: expect.objectContaining({ amount: "45000.00", method: "bank_transfer" }),
        }),
      ]);
    });

    it("reverses records, keeps them, and only then allows cancellation", async () => {
      const { cookie, path, pay } = await issued();
      await pay({ amount: "20000" }).expect(201);
      await api().post(`${path}/cancel`).set("Cookie", cookie).expect(409);

      const [payment] = (await api().get(`${path}/payments`).set("Cookie", cookie)).body;
      await api()
        .post(`${path}/payments/${payment.id}/reverse`)
        .set("Cookie", cookie)
        .send({})
        .expect(400);
      const reversed = await api()
        .post(`${path}/payments/${payment.id}/reverse`)
        .set("Cookie", cookie)
        .send({ reason: "Recorded on the wrong invoice" })
        .expect(200);
      // Back to Ready, but still locked: payment activity happened (D043).
      expect(reversed.body).toMatchObject({
        status: "ready",
        paymentsReceived: "0.00",
        financialsLocked: true,
      });

      const history = await api().get(`${path}/payments`).set("Cookie", cookie).expect(200);
      expect(history.body[0].reversedAt).not.toBeNull();
      expect(history.body[0].changes[0]).toMatchObject({ kind: "reversal" });

      const cancelled = await api().post(`${path}/cancel`).set("Cookie", cookie).expect(200);
      expect(cancelled.body).toMatchObject({ status: "cancelled", invoiceNumber: "INV-00001" });
      // Cancellation keeps the number and the allowance use (D019).
      const usage = await api().get("/api/v1/usage").set("Cookie", cookie).expect(200);
      expect(usage.body.used).toBe(1);
      await api()
        .post(`${path}/payments`)
        .set("Cookie", cookie)
        .send({ amount: "1", method: "mpesa", paymentDate: today })
        .expect(409);
    });
  });

  describe("public links", () => {
    const viewPublic = (token: string) => api().get(`/api/v1/public/invoices/${token}`);

    it("shares the invoice without an account and without internal ids", async () => {
      const { cookie, path, pay } = await issued({ notes: "Thank you" });
      await pay({ amount: "20000" }).expect(201);
      const link = await api().post(`${path}/link`).set("Cookie", cookie).expect(201);
      expect(link.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const view = await viewPublic(link.body.token).expect(200);
      expect(view.body).toMatchObject({
        invoiceNumber: "INV-00001",
        status: "partially_paid",
        paymentsReceived: "20000.00",
        balanceDue: "30000.00",
        notes: "Thank you",
        client: { name: "Acacia Creative" },
      });
      const json = JSON.stringify(view.body);
      expect(json).not.toContain('"id"');
      expect(json).not.toContain("clientId");
      expect(json).not.toContain("QK12");
      expect(view.body.client).not.toHaveProperty("phone");

      const status = await api().get(`${path}/link`).set("Cookie", cookie).expect(200);
      expect(status.body.link).toMatchObject({ id: link.body.id });
      expect(status.body.link).not.toHaveProperty("token");
    });

    it("stops old links when replaced or disabled, and hides cancelled invoices", async () => {
      const { cookie, path } = await issued();
      const first = (await api().post(`${path}/link`).set("Cookie", cookie)).body.token;
      const second = (await api().post(`${path}/link`).set("Cookie", cookie)).body.token;

      const old = await viewPublic(first).expect(404);
      expect(old.body.code).toBe("INVOICE_UNAVAILABLE");
      await viewPublic(second).expect(200);

      await api().delete(`${path}/link`).set("Cookie", cookie).expect(204);
      await viewPublic(second).expect(404);
      const status = await api().get(`${path}/link`).set("Cookie", cookie).expect(200);
      expect(status.body).toEqual({ link: null });

      const third = (await api().post(`${path}/link`).set("Cookie", cookie)).body.token;
      await api().post(`${path}/cancel`).set("Cookie", cookie).expect(200);
      await viewPublic(third).expect(404);
      await api().post(`${path}/link`).set("Cookie", cookie).expect(409);
    });

    it("expires links after 30 days", async () => {
      const { cookie, path, invoiceId } = await issued();
      const link = await api().post(`${path}/link`).set("Cookie", cookie).expect(201);
      const expiresIn = Date.parse(link.body.expiresAt) - Date.parse(link.body.createdAt);
      expect(expiresIn).toBe(30 * 24 * 60 * 60 * 1000);

      const { db } = app.get<DatabaseConnection>(DATABASE);
      await db
        .update(schema.invoiceLinks)
        .set({
          createdAt: sql`now() - interval '31 days'`,
          expiresAt: sql`now() - interval '1 day'`,
        })
        .where(sql`${schema.invoiceLinks.invoiceId} = ${invoiceId}`);
      await viewPublic(link.body.token).expect(404);
    });

    it("rejects malformed tokens and drafts", async () => {
      await viewPublic("not-a-token").expect(404);
      const { cookie, base, clientId } = await issued();
      const draft = await api()
        .post(base)
        .set("Cookie", cookie)
        .send({ clientId, issueDate: today, dueDate: today, items: [] });
      await api().post(`${base}/${draft.body.id}/link`).set("Cookie", cookie).expect(409);
    });
  });

  describe("PDFs", () => {
    function pageCount(pdf: Buffer): number {
      return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    }

    it("downloads an A4 PDF for the owner and through a public link", async () => {
      const { cookie, path } = await issued();
      const owner = await api()
        .get(`${path}/pdf`)
        .set("Cookie", cookie)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(owner.headers["content-type"]).toBe("application/pdf");
      expect(owner.headers["content-disposition"]).toContain('filename="INV-00001.pdf"');
      expect((owner.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      expect(pageCount(owner.body)).toBe(1);

      const token = (await api().post(`${path}/link`).set("Cookie", cookie)).body.token;
      await api().get(`/api/v1/public/invoices/${token}/pdf`).expect(200);
    });

    it("flows long invoices across pages", async () => {
      const items = Array.from({ length: 80 }, (_, index) => ({
        description: `Line item ${index + 1}`,
        quantity: "1",
        unitPrice: "100",
      }));
      const { cookie, path } = await issued({ items });
      const pdf = await api()
        .get(`${path}/pdf`)
        .set("Cookie", cookie)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(pageCount(pdf.body)).toBeGreaterThan(1);
    });
  });

  describe("dashboard", () => {
    it("totals outstanding, overdue and this month's effective receipts", async () => {
      const { cookie, businessId, base, clientId, pay } = await issued();
      await pay({ amount: "20000" }).expect(201);

      // An overdue invoice: due well in the past.
      const late = await api()
        .post(base)
        .set("Cookie", cookie)
        .send({
          clientId,
          issueDate: "2026-01-01",
          dueDate: "2026-01-15",
          items: [{ description: "Retainer", quantity: "1", unitPrice: "10000" }],
        });
      await api().post(`${base}/${late.body.id}/ready`).set("Cookie", cookie).expect(200);
      const latePayment = await api()
        .post(`${base}/${late.body.id}/payments`)
        .set("Cookie", cookie)
        .send({ amount: "2500", method: "other", paymentDate: today })
        .expect(201);
      expect(latePayment.body.overdue).toBe(true);
      const [reversible] = (
        await api().get(`${base}/${late.body.id}/payments`).set("Cookie", cookie)
      ).body;
      await api()
        .post(`${base}/${late.body.id}/payments/${reversible.id}/reverse`)
        .set("Cookie", cookie)
        .send({ reason: "Duplicate entry" })
        .expect(200);

      // A draft counts toward nothing.
      await api()
        .post(base)
        .set("Cookie", cookie)
        .send({ clientId, issueDate: today, dueDate: today, items: [] });

      const dashboard = await api()
        .get(`/api/v1/businesses/${businessId}/dashboard`)
        .set("Cookie", cookie)
        .expect(200);
      expect(dashboard.body).toMatchObject({
        outstanding: "40000.00",
        overdue: "10000.00",
        receivedThisMonth: "20000.00",
      });
      expect(dashboard.body.recentInvoices).toHaveLength(2);

      const overdueList = await api()
        .get(base)
        .query({ status: "overdue" })
        .set("Cookie", cookie)
        .expect(200);
      expect(overdueList.body).toHaveLength(1);
    });
  });

  it("keeps payments, links and PDFs private to the owner", async () => {
    const owner = await issued();
    const stranger = (await signUp(app)).cookie;
    await api().get(`${owner.path}/payments`).set("Cookie", stranger).expect(404);
    await api().post(`${owner.path}/link`).set("Cookie", stranger).expect(404);
    await api().get(`${owner.path}/pdf`).set("Cookie", stranger).expect(404);
    await api()
      .post(`${owner.path}/payments`)
      .set("Cookie", stranger)
      .send({ amount: "1", method: "mpesa", paymentDate: today })
      .expect(404);
    await api()
      .get(`/api/v1/businesses/${owner.businessId}/dashboard`)
      .set("Cookie", stranger)
      .expect(404);
  });
});
