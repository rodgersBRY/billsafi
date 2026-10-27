import type { INestApplication } from "@nestjs/common";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { addNairobiMonths } from "@billsafi/domain";
import request from "supertest";
import { DATABASE } from "../src/database/database.module.js";
import { createBusiness, createClient, createTestApp, signUp } from "./support/app.js";

// A 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("logos and invoice branding", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const { cookie, email } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const upload = (body: Buffer, type = "image/png") =>
      api()
        .put(`/api/v1/businesses/${businessId}/logo`)
        .set("Cookie", cookie)
        .set("Content-Type", type)
        .send(body);
    const readyInvoiceLink = async () => {
      const path = `/api/v1/businesses/${businessId}/invoices`;
      const draft = await api()
        .post(path)
        .set("Cookie", cookie)
        .send({
          clientId,
          issueDate: "2026-10-16",
          dueDate: "2026-10-30",
          items: [{ description: "Design", quantity: "1", unitPrice: "1000" }],
        })
        .expect(201);
      await api().post(`${path}/${draft.body.id}/ready`).set("Cookie", cookie).expect(200);
      const link = await api().post(`${path}/${draft.body.id}/link`).set("Cookie", cookie);
      return link.body.token as string;
    };
    return { cookie, email, businessId, upload, readyInvoiceLink };
  }

  it("stores a PNG logo and serves it to the owner only", async () => {
    const owner = await setup();
    const other = await setup();
    const business = await owner.upload(PNG).expect(200);
    expect(business.body.logoKey).toMatch(/^[0-9a-f-]{36}$/);

    const path = `/api/v1/businesses/${owner.businessId}/logos/${business.body.logoKey}`;
    const image = await api().get(path).set("Cookie", owner.cookie).expect(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(Buffer.from(image.body)).toEqual(PNG);
    await api().get(path).set("Cookie", other.cookie).expect(404);
  });

  it("rejects files that are not PNG or JPEG, or are too large", async () => {
    const { upload } = await setup();
    const fake = await upload(Buffer.from("not really a png")).expect(400);
    expect(fake.body.code).toBe("LOGO_INVALID");
    const big = Buffer.concat([PNG, Buffer.alloc(600 * 1024)]);
    const tooLarge = await upload(big).expect(400);
    expect(tooLarge.body.code).toBe("LOGO_TOO_LARGE");
  });

  it("keeps the issued logo on the public invoice after the logo changes", async () => {
    const account = await setup();
    await account.upload(PNG).expect(200);
    const token = await account.readyInvoiceLink();
    await api()
      .delete(`/api/v1/businesses/${account.businessId}/logo`)
      .set("Cookie", account.cookie)
      .expect(200);

    const view = await api().get(`/api/v1/public/invoices/${token}`).expect(200);
    expect(view.body).toMatchObject({ hasLogo: true, showBranding: true });
    expect(view.body.business).not.toHaveProperty("logoKey");
    const logo = await api().get(`/api/v1/public/invoices/${token}/logo`).expect(200);
    expect(Buffer.from(logo.body)).toEqual(PNG);
    await api().get(`/api/v1/public/invoices/${token}/pdf`).expect(200);
  });

  it("hides the BillSafi footer for Pro accounts", async () => {
    const account = await setup();
    const token = await account.readyInvoiceLink();
    const db = app.get<DatabaseConnection>(DATABASE).db;
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, account.email));
    // Marking the invoice Ready created the account's subscription row.
    const anchorAt = new Date(Date.now() - 60_000);
    await db
      .update(schema.subscriptions)
      .set({ anchorAt, paidMonths: 1, paidUntil: addNairobiMonths(anchorAt, 1) })
      .where(eq(schema.subscriptions.userId, user!.id));

    const view = await api().get(`/api/v1/public/invoices/${token}`).expect(200);
    expect(view.body).toMatchObject({ hasLogo: false, showBranding: false });
    await api().get(`/api/v1/public/invoices/${token}/logo`).expect(404);
  });
});
