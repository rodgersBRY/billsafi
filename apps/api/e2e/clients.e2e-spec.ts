import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  createBusiness,
  createClient,
  createTestApp,
  sampleClient,
  signUp,
} from "./support/app.js";

describe("clients", () => {
  let app: INestApplication;
  let cookie: string;
  let businessId: string;

  const api = () => request(app.getHttpServer());
  const clientsPath = (id = businessId) => `/api/v1/businesses/${id}/clients`;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    cookie = (await signUp(app)).cookie;
    businessId = await createBusiness(app, cookie);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a client with normalized phone and blank optional fields cleared", async () => {
    const response = await api()
      .post(clientsPath())
      .set("Cookie", cookie)
      .send({ ...sampleClient, companyName: "", kraPin: "p051234567x" })
      .expect(201);

    expect(response.body).toMatchObject({
      name: "Acacia Creative",
      phone: "+254722111222",
      companyName: null,
      kraPin: "P051234567X",
      archivedAt: null,
    });
  });

  it("requires name and phone", async () => {
    const response = await api().post(clientsPath()).set("Cookie", cookie).send({}).expect(400);
    expect(response.body.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([
      "name",
      "phone",
    ]);
  });

  it("searches by name, company, email or phone and sorts by name", async () => {
    const business = await createBusiness(app, cookie);
    await createClient(app, cookie, business, { name: "zebra Studio", phone: "0711000001" });
    await createClient(app, cookie, business, {
      name: "Njeri Wambui",
      companyName: "Kijani Collective",
      phone: "0711000002",
    });
    await createClient(app, cookie, business, { name: "Baraka 100%", phone: "0711000003" });

    const all = await api().get(clientsPath(business)).set("Cookie", cookie).expect(200);
    expect(all.body.map((client: { name: string }) => client.name)).toEqual([
      "Baraka 100%",
      "Njeri Wambui",
      "zebra Studio",
    ]);

    const byCompany = await api()
      .get(clientsPath(business))
      .query({ search: "kijani" })
      .set("Cookie", cookie)
      .expect(200);
    expect(byCompany.body).toHaveLength(1);

    const byPhone = await api()
      .get(clientsPath(business))
      .query({ search: "711000003" })
      .set("Cookie", cookie)
      .expect(200);
    expect(byPhone.body[0].name).toBe("Baraka 100%");

    // Wildcards are matched literally.
    const literal = await api()
      .get(clientsPath(business))
      .query({ search: "%" })
      .set("Cookie", cookie)
      .expect(200);
    expect(literal.body.map((client: { name: string }) => client.name)).toEqual(["Baraka 100%"]);
  });

  it("edits a client and archives it out of the active list", async () => {
    const clientId = await createClient(app, cookie, businessId, { name: "Temporary Client" });

    const edited = await api()
      .patch(`${clientsPath()}/${clientId}`)
      .set("Cookie", cookie)
      .send({ name: "Renamed Client" })
      .expect(200);
    expect(edited.body.name).toBe("Renamed Client");

    const archived = await api()
      .post(`${clientsPath()}/${clientId}/archive`)
      .set("Cookie", cookie)
      .expect(200);
    expect(archived.body.archivedAt).not.toBeNull();

    const active = await api().get(clientsPath()).set("Cookie", cookie).expect(200);
    expect(active.body.some((client: { id: string }) => client.id === clientId)).toBe(false);
    const archivedList = await api()
      .get(clientsPath())
      .query({ status: "archived" })
      .set("Cookie", cookie)
      .expect(200);
    expect(archivedList.body.some((client: { id: string }) => client.id === clientId)).toBe(true);
  });

  it("keeps clients separate between businesses and accounts", async () => {
    const clientId = await createClient(app, cookie, businessId);
    const otherBusiness = await createBusiness(app, cookie, { displayName: "Second Studio" });
    const stranger = (await signUp(app)).cookie;
    const strangerBusiness = await createBusiness(app, stranger);

    // Same account, different business.
    await api()
      .get(`${clientsPath(otherBusiness)}/${clientId}`)
      .set("Cookie", cookie)
      .expect(404);
    // Another account, guessing the path.
    await api().get(`${clientsPath()}/${clientId}`).set("Cookie", stranger).expect(404);
    await api()
      .patch(`${clientsPath(strangerBusiness)}/${clientId}`)
      .set("Cookie", stranger)
      .send({ name: "Hijacked" })
      .expect(404);
    await api().get(`${clientsPath()}/not-a-uuid`).set("Cookie", cookie).expect(404);
  });
});
