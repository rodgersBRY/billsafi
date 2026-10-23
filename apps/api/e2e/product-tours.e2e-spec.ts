import type { INestApplication } from "@nestjs/common";
import { nairobiDate } from "@billsafi/domain";
import request from "supertest";
import { createBusiness, createClient, createTestApp, signUp } from "./support/app.js";

const today = nairobiDate(new Date());

describe("product tours and getting started", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires a session", async () => {
    await api().get("/api/v1/me/tours").expect(401);
    await api().get("/api/v1/me/getting-started").expect(401);
  });

  it("starts empty, saves a tour and updates it in place", async () => {
    const { cookie } = await signUp(app);
    const list = await api().get("/api/v1/me/tours").set("Cookie", cookie).expect(200);
    expect(list.body).toEqual([]);

    await api()
      .put("/api/v1/me/tours/first-run")
      .set("Cookie", cookie)
      .send({ version: 1, status: "dismissed", lastStep: 2 })
      .expect(200);
    await api()
      .put("/api/v1/me/tours/first-run")
      .set("Cookie", cookie)
      .send({ version: 1, status: "completed", lastStep: 5 })
      .expect(200);

    const saved = await api().get("/api/v1/me/tours").set("Cookie", cookie).expect(200);
    expect(saved.body).toEqual([
      expect.objectContaining({ key: "first-run", version: 1, status: "completed", lastStep: 5 }),
    ]);

    // Another account does not see it.
    const other = await signUp(app);
    const otherList = await api().get("/api/v1/me/tours").set("Cookie", other.cookie).expect(200);
    expect(otherList.body).toEqual([]);
  });

  it("rejects unknown tours and invalid bodies", async () => {
    const { cookie } = await signUp(app);
    await api()
      .put("/api/v1/me/tours/everything")
      .set("Cookie", cookie)
      .send({ version: 1, status: "completed" })
      .expect(400);
    const bad = await api()
      .put("/api/v1/me/tours/first-run")
      .set("Cookie", cookie)
      .send({ version: 0, status: "paused" })
      .expect(400);
    expect(bad.body.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([
      "status",
      "version",
    ]);
  });

  it("marks each first step done as the account works", async () => {
    const { cookie } = await signUp(app);
    const progress = async () =>
      (await api().get("/api/v1/me/getting-started").set("Cookie", cookie).expect(200)).body;

    expect(await progress()).toEqual({
      addClient: false,
      createInvoice: false,
      shareInvoice: false,
      paymentInstructions: false,
      recordPayment: false,
    });

    // Steps done in a second business still count for the account.
    await createBusiness(app, cookie);
    const businessId = await createBusiness(app, cookie, { displayName: "Second" });
    const clientId = await createClient(app, cookie, businessId);
    expect(await progress()).toMatchObject({ addClient: true, createInvoice: false });

    await api()
      .post(`/api/v1/businesses/${businessId}/payment-instructions`)
      .set("Cookie", cookie)
      .send({ method: "mpesa_personal", accountNumber: "0712345678" })
      .expect(201);

    const base = `/api/v1/businesses/${businessId}/invoices`;
    const draft = await api()
      .post(base)
      .set("Cookie", cookie)
      .send({
        clientId,
        issueDate: today,
        dueDate: today,
        items: [{ description: "Website build", quantity: "1", unitPrice: "50000" }],
      })
      .expect(201);
    expect(await progress()).toMatchObject({
      createInvoice: true,
      paymentInstructions: true,
      shareInvoice: false,
    });

    const path = `${base}/${draft.body.id}`;
    await api().post(`${path}/ready`).set("Cookie", cookie).expect(200);
    await api().post(`${path}/link`).set("Cookie", cookie).expect(201);
    await api()
      .post(`${path}/payments`)
      .set("Cookie", cookie)
      .send({ method: "mpesa", paymentDate: today, amount: "1000" })
      .expect(201);

    expect(await progress()).toEqual({
      addClient: true,
      createInvoice: true,
      shareInvoice: true,
      paymentInstructions: true,
      recordPayment: true,
    });

    // Progress from one account never leaks into another.
    const other = await signUp(app);
    const otherProgress = await api()
      .get("/api/v1/me/getting-started")
      .set("Cookie", other.cookie)
      .expect(200);
    expect(Object.values(otherProgress.body)).toEqual([false, false, false, false, false]);
  });
});
