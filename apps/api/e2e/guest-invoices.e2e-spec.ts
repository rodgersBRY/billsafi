import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createBusiness, createClient, createTestApp, signUp } from "./support/app.js";

const draft = {
  business: {
    profileType: "individual",
    displayName: "Amani Njeri",
    contactEmail: "amani@example.test",
    phone: "0712 345 678",
  },
  client: { name: "Karibu Coffee", phone: "0722 111 222" },
  invoice: {
    issueDate: "2026-10-23",
    dueDate: "2026-11-06",
    items: [{ description: "Social content design", quantity: "1", unitPrice: "24000" }],
    paymentInstructions: "M-Pesa 0712 345 678",
  },
};

describe("guest invoice import", () => {
  let app: INestApplication;

  const api = () => request(app.getHttpServer());
  const importDraft = (cookie: string, body: object = draft) =>
    api().post("/api/v1/guest-invoices/import").set("Cookie", cookie).send(body);

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates the business, client and draft for a new account", async () => {
    const { cookie } = await signUp(app);

    const response = await importDraft(cookie).expect(201);
    expect(response.body.usedExistingBusiness).toBe(false);

    const { businessId, invoiceId } = response.body;
    const invoice = await api()
      .get(`/api/v1/businesses/${businessId}/invoices/${invoiceId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(invoice.body).toMatchObject({
      status: "draft",
      client: { name: "Karibu Coffee" },
      business: { displayName: "Amani Njeri" },
      total: "24000.00",
    });

    // Drafts use no allowance; only Mark as Ready does.
    const usage = await api().get("/api/v1/usage").set("Cookie", cookie).expect(200);
    expect(usage.body.used).toBe(0);
  });

  it("saves into the account's existing business", async () => {
    const { cookie } = await signUp(app);
    const businessId = await createBusiness(app, cookie);

    const response = await importDraft(cookie).expect(201);
    expect(response.body).toMatchObject({ businessId, usedExistingBusiness: true });

    const businesses = await api().get("/api/v1/businesses").set("Cookie", cookie).expect(200);
    expect(businesses.body).toHaveLength(1);
  });

  it("reuses an active client with the same phone", async () => {
    const { cookie } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId, { phone: "0722 111 222" });

    const response = await importDraft(cookie).expect(201);
    const invoice = await api()
      .get(`/api/v1/businesses/${businessId}/invoices/${response.body.invoiceId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(invoice.body.clientId).toBe(clientId);
  });

  it("rejects an invalid draft without creating anything", async () => {
    const { cookie } = await signUp(app);

    const response = await importDraft(cookie, {
      ...draft,
      client: { name: "Karibu Coffee" },
    }).expect(400);
    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toContain(
      "client.phone",
    );

    const businesses = await api().get("/api/v1/businesses").set("Cookie", cookie).expect(200);
    expect(businesses.body).toHaveLength(0);
  });

  it("requires a session", async () => {
    await api().post("/api/v1/guest-invoices/import").send(draft).expect(401);
  });
});
