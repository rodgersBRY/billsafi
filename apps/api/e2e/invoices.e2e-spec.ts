import type { INestApplication } from "@nestjs/common";
import { FREE_PLAN } from "@billsafi/domain";
import request from "supertest";
import { createBusiness, createClient, createTestApp, signUp } from "./support/app.js";

const draftBody = (clientId: string, overrides: Record<string, unknown> = {}) => ({
  clientId,
  issueDate: "2026-10-16",
  dueDate: "2026-10-30",
  items: [
    { description: "Brand identity", quantity: "1", unitPrice: "45000" },
    { description: "Workshop hours", quantity: "2.5", unitPrice: "3000" },
  ],
  ...overrides,
});

describe("invoices", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  /** A fresh account with one business and one client, so allowance counts start at zero. */
  async function setup() {
    const { cookie } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const path = `/api/v1/businesses/${businessId}/invoices`;
    const draft = async (overrides: Record<string, unknown> = {}) =>
      (
        await api()
          .post(path)
          .set("Cookie", cookie)
          .send(draftBody(clientId, overrides))
          .expect(201)
      ).body as { id: string };
    const ready = (invoiceId: string) =>
      api().post(`${path}/${invoiceId}/ready`).set("Cookie", cookie);
    return { cookie, businessId, clientId, path, draft, ready };
  }

  it("creates a draft with calculated totals and no number", async () => {
    const { cookie, clientId, path } = await setup();
    const response = await api()
      .post(path)
      .set("Cookie", cookie)
      .send(draftBody(clientId, { discount: { type: "percentage", value: "10" }, taxRate: "16" }))
      .expect(201);

    expect(response.body).toMatchObject({
      status: "draft",
      invoiceNumber: null,
      subtotal: "52500.00",
      discountAmount: "5250.00",
      taxAmount: "7560.00",
      total: "54810.00",
      balanceDue: "54810.00",
      paymentsReceived: "0.00",
      client: { name: "Acacia Creative", phone: "+254722111222" },
    });
    expect(response.body.items.map((item: { lineTotal: string }) => item.lineTotal)).toEqual([
      "45000.00",
      "7500.00",
    ]);
  });

  it("rejects a discount above the subtotal on the discount field", async () => {
    const { cookie, clientId, path } = await setup();
    const response = await api()
      .post(path)
      .set("Cookie", cookie)
      .send(draftBody(clientId, { discount: { type: "fixed", value: "60000" } }))
      .expect(400);
    expect(response.body.issues[0].path).toBe("discount.value");
  });

  it("only accepts active clients from the same business", async () => {
    const { cookie, businessId, path } = await setup();
    const otherBusiness = await createBusiness(app, cookie, { displayName: "Second Studio" });
    const foreignClient = await createClient(app, cookie, otherBusiness);
    await api().post(path).set("Cookie", cookie).send(draftBody(foreignClient)).expect(400);

    const archivedClient = await createClient(app, cookie, businessId, { name: "Old Client" });
    await api()
      .post(`/api/v1/businesses/${businessId}/clients/${archivedClient}/archive`)
      .set("Cookie", cookie)
      .expect(200);
    const response = await api()
      .post(path)
      .set("Cookie", cookie)
      .send(draftBody(archivedClient))
      .expect(400);
    expect(response.body.issues[0].path).toBe("clientId");
  });

  it("numbers Ready invoices per business with five digits, once each", async () => {
    const { cookie, path, draft, ready } = await setup();
    const first = await draft();
    const second = await draft();

    const firstReady = await ready(first.id).expect(200);
    expect(firstReady.body).toMatchObject({ status: "ready", invoiceNumber: "INV-00001" });
    expect((await ready(second.id).expect(200)).body.invoiceNumber).toBe("INV-00002");

    // Marking Ready again changes nothing and uses no allowance.
    expect((await ready(first.id).expect(200)).body.invoiceNumber).toBe("INV-00001");
    const usage = await api().get("/api/v1/usage").set("Cookie", cookie).expect(200);
    expect(usage.body).toMatchObject({ plan: "free", limit: FREE_PLAN.invoiceLimit, used: 2 });

    // A second business starts its own sequence.
    const otherBusiness = await createBusiness(app, cookie, { displayName: "Second Studio" });
    const otherClient = await createClient(app, cookie, otherBusiness);
    const otherPath = `/api/v1/businesses/${otherBusiness}/invoices`;
    const otherDraft = await api()
      .post(otherPath)
      .set("Cookie", cookie)
      .send(draftBody(otherClient))
      .expect(201);
    const otherReady = await api()
      .post(`${otherPath}/${otherDraft.body.id}/ready`)
      .set("Cookie", cookie)
      .expect(200);
    expect(otherReady.body.invoiceNumber).toBe("INV-00001");

    const list = await api().get(path).set("Cookie", cookie).query({ status: "ready" }).expect(200);
    expect(list.body).toHaveLength(2);
  });

  it("requires at least one line item before Ready", async () => {
    const { draft, ready } = await setup();
    const empty = await draft({ items: [] });
    const response = await ready(empty.id).expect(400);
    expect(response.body.issues[0].path).toBe("items");
  });

  it("keeps the client details copied at Ready when the client changes", async () => {
    const { cookie, businessId, clientId, path, draft, ready } = await setup();
    const issued = await draft();
    await ready(issued.id).expect(200);
    const stillDraft = await draft();

    await api()
      .patch(`/api/v1/businesses/${businessId}/clients/${clientId}`)
      .set("Cookie", cookie)
      .send({ name: "Acacia Creative Ltd" })
      .expect(200);

    const issuedView = await api().get(`${path}/${issued.id}`).set("Cookie", cookie).expect(200);
    expect(issuedView.body.client.name).toBe("Acacia Creative");
    const draftView = await api().get(`${path}/${stillDraft.id}`).set("Cookie", cookie).expect(200);
    expect(draftView.body.client.name).toBe("Acacia Creative Ltd");

    // Saving the Ready invoice before any payment copies the current details again (D048).
    const resaved = await api()
      .put(`${path}/${issued.id}`)
      .set("Cookie", cookie)
      .send(draftBody(clientId, { notes: "Thank you" }))
      .expect(200);
    expect(resaved.body).toMatchObject({
      invoiceNumber: "INV-00001",
      notes: "Thank you",
      client: { name: "Acacia Creative Ltd" },
    });
  });

  it("deletes drafts but never issued invoices", async () => {
    const { cookie, path, draft, ready } = await setup();
    const removable = await draft();
    await api().delete(`${path}/${removable.id}`).set("Cookie", cookie).expect(204);
    await api().get(`${path}/${removable.id}`).set("Cookie", cookie).expect(404);

    const issued = await draft();
    await ready(issued.id).expect(200);
    await api().delete(`${path}/${issued.id}`).set("Cookie", cookie).expect(409);
  });

  it("stops at the Free limit of Ready invoices per month across all businesses", async () => {
    const { cookie, path, draft, ready } = await setup();
    for (let index = 0; index < FREE_PLAN.invoiceLimit - 1; index++) {
      await ready((await draft()).id).expect(200);
    }
    const otherBusiness = await createBusiness(app, cookie, { displayName: "Second Studio" });
    const otherClient = await createClient(app, cookie, otherBusiness);
    const otherPath = `/api/v1/businesses/${otherBusiness}/invoices`;
    const last = await api().post(otherPath).set("Cookie", cookie).send(draftBody(otherClient));
    await api().post(`${otherPath}/${last.body.id}/ready`).set("Cookie", cookie).expect(200);

    const overLimit = await draft();
    const refused = await ready(overLimit.id).expect(409);
    expect(refused.body).toMatchObject({
      code: "ALLOWANCE_REACHED",
      usage: { used: FREE_PLAN.invoiceLimit, limit: FREE_PLAN.invoiceLimit },
    });
    // The refused invoice stays a draft without a number.
    const view = await api().get(`${path}/${overLimit.id}`).set("Cookie", cookie).expect(200);
    expect(view.body).toMatchObject({ status: "draft", invoiceNumber: null });
  });

  it("never exceeds the allowance or duplicates numbers under concurrent requests", async () => {
    const { cookie, path, draft } = await setup();
    const otherBusiness = await createBusiness(app, cookie, { displayName: "Second Studio" });
    const otherClient = await createClient(app, cookie, otherBusiness);
    const otherPath = `/api/v1/businesses/${otherBusiness}/invoices`;

    const targets: string[] = [];
    for (let index = 0; index < 6; index++) {
      targets.push(`${path}/${(await draft()).id}/ready`);
      const other = await api().post(otherPath).set("Cookie", cookie).send(draftBody(otherClient));
      targets.push(`${otherPath}/${other.body.id}/ready`);
    }
    // Every request twice, all at once: 24 requests for 12 drafts.
    const responses = await Promise.all(
      [...targets, ...targets].map((target) => api().post(target).set("Cookie", cookie)),
    );

    const succeeded = new Map<string, string>();
    for (const [index, response] of responses.entries()) {
      expect([200, 409]).toContain(response.status);
      if (response.status === 200)
        succeeded.set(targets[index % targets.length]!, response.body.invoiceNumber);
    }
    expect(succeeded.size).toBe(10);

    const usage = await api().get("/api/v1/usage").set("Cookie", cookie).expect(200);
    expect(usage.body.used).toBe(10);

    for (const listPath of [path, otherPath]) {
      const list = await api().get(listPath).set("Cookie", cookie).query({ status: "ready" });
      const numbers = list.body
        .map((invoice: { invoiceNumber: string }) => invoice.invoiceNumber)
        .sort();
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers).toEqual(
        numbers.map((_: string, index: number) => `INV-${String(index + 1).padStart(5, "0")}`),
      );
    }
  });

  it("hides invoices from other businesses and accounts", async () => {
    const owner = await setup();
    const invoice = await owner.draft();
    const stranger = (await signUp(app)).cookie;
    const strangerBusiness = await createBusiness(app, stranger);
    const sameOwnerOtherBusiness = await createBusiness(app, owner.cookie);

    await api().get(`${owner.path}/${invoice.id}`).set("Cookie", stranger).expect(404);
    await api()
      .get(`/api/v1/businesses/${strangerBusiness}/invoices/${invoice.id}`)
      .set("Cookie", stranger)
      .expect(404);
    await api()
      .post(`/api/v1/businesses/${strangerBusiness}/invoices/${invoice.id}/ready`)
      .set("Cookie", stranger)
      .expect(404);
    await api()
      .get(`/api/v1/businesses/${sameOwnerOtherBusiness}/invoices/${invoice.id}`)
      .set("Cookie", owner.cookie)
      .expect(404);
  });
});
