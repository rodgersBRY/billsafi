import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, signUp } from "./support/app.js";

const newBusiness = {
  profileType: "individual",
  displayName: "Wanjiku Designs",
  contactEmail: "hello@wanjiku.example.test",
  phone: "0712 345 678",
};

describe("businesses", () => {
  let app: INestApplication;
  let owner: string;
  let stranger: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp());
    owner = (await signUp(app)).cookie;
    stranger = (await signUp(app)).cookie;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createBusiness(cookie: string, body: object = newBusiness) {
    const response = await api()
      .post("/api/v1/businesses")
      .set("Cookie", cookie)
      .send(body)
      .expect(201);
    return response.body as { id: string };
  }

  it("requires a session", async () => {
    await api().get("/api/v1/businesses").expect(401);
    await api().post("/api/v1/businesses").send(newBusiness).expect(401);
  });

  it("creates a business with normalized phone and KES/14-day defaults", async () => {
    const response = await api()
      .post("/api/v1/businesses")
      .set("Cookie", owner)
      .send({ ...newBusiness, kraPin: "a123456789z" })
      .expect(201);

    expect(response.body).toMatchObject({
      displayName: "Wanjiku Designs",
      phone: "+254712345678",
      kraPin: "A123456789Z",
      defaultCurrency: "KES",
      defaultPaymentTermsDays: 14,
    });
    expect(response.body).not.toHaveProperty("ownerUserId");
    expect(response.body).not.toHaveProperty("nextInvoiceSequence");
  });

  it("rejects invalid input with field-level messages", async () => {
    const response = await api()
      .post("/api/v1/businesses")
      .set("Cookie", owner)
      .send({ ...newBusiness, phone: "12345", displayName: "" })
      .expect(400);

    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "phone" }),
        expect.objectContaining({ path: "displayName" }),
      ]),
    );
  });

  it("supports several businesses per account and lists only the account's own", async () => {
    const cookie = (await signUp(app)).cookie;
    const first = await createBusiness(cookie);
    const second = await createBusiness(cookie, { ...newBusiness, displayName: "Second Studio" });
    await createBusiness(stranger, { ...newBusiness, displayName: "Not yours" });

    const list = await api().get("/api/v1/businesses").set("Cookie", cookie).expect(200);
    expect(list.body.map((business: { id: string }) => business.id)).toEqual([first.id, second.id]);
  });

  it("hides another account's business as not found", async () => {
    const business = await createBusiness(owner);
    const path = `/api/v1/businesses/${business.id}`;

    await api().get(path).set("Cookie", owner).expect(200);
    await api().get(path).set("Cookie", stranger).expect(404);
    await api().patch(path).set("Cookie", stranger).send({ displayName: "Taken" }).expect(404);
    await api().get(`${path}/payment-instructions`).set("Cookie", stranger).expect(404);
    await api()
      .post(`${path}/payment-instructions`)
      .set("Cookie", stranger)
      .send({ method: "mpesa_till", accountNumber: "123456" })
      .expect(404);

    const unchanged = await api().get(path).set("Cookie", owner).expect(200);
    expect(unchanged.body.displayName).toBe("Wanjiku Designs");
  });

  it("treats a malformed business id as not found", async () => {
    await api().get("/api/v1/businesses/not-a-uuid").set("Cookie", owner).expect(404);
  });

  it("updates the owner's business", async () => {
    const business = await createBusiness(owner);
    const response = await api()
      .patch(`/api/v1/businesses/${business.id}`)
      .set("Cookie", owner)
      .send({ displayName: "Wanjiku Design Studio", defaultPaymentTermsDays: 30 })
      .expect(200);

    expect(response.body).toMatchObject({
      displayName: "Wanjiku Design Studio",
      defaultPaymentTermsDays: 30,
    });
  });

  it("records payment instructions for each supported method", async () => {
    const business = await createBusiness(owner);
    const path = `/api/v1/businesses/${business.id}/payment-instructions`;

    await api()
      .post(path)
      .set("Cookie", owner)
      .send({ method: "mpesa_personal", accountNumber: "0712345678" })
      .expect(201);
    await api()
      .post(path)
      .set("Cookie", owner)
      .send({ method: "bank_transfer", instructions: "Equity Bank, account 0123456789" })
      .expect(201);
    await api().post(path).set("Cookie", owner).send({ method: "bank_transfer" }).expect(400);

    const list = await api().get(path).set("Cookie", owner).expect(200);
    expect(list.body).toMatchObject([
      { method: "mpesa_personal", accountNumber: "+254712345678" },
      { method: "bank_transfer", accountNumber: null },
    ]);
  });
});
