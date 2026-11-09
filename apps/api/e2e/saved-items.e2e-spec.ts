import type { INestApplication } from "@nestjs/common";
import { addCalendarDays, nairobiDate } from "@billsafi/domain";
import request from "supertest";
import {
  createBusiness,
  createClient,
  createExtraBusiness,
  createTestApp,
  makePro,
  signUp,
} from "./support/app.js";

const today = nairobiDate(new Date());

describe("saved items", () => {
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
    const itemsPath = (id = businessId) => `/api/v1/businesses/${id}/items`;
    const save = async (description: string, unitPrice = "1000", business = businessId) =>
      (
        await api()
          .post(itemsPath(business))
          .set("Cookie", cookie)
          .send({ description, unitPrice })
          .expect(201)
      ).body as { id: string };
    return { cookie, email, businessId, itemsPath, save };
  }

  async function list(cookie: string, path: string) {
    return (await api().get(path).set("Cookie", cookie).expect(200)).body as {
      id: string;
      description: string;
      useCount: number;
    }[];
  }

  it("creates, edits and archives a saved item", async () => {
    const { cookie, itemsPath } = await setup();
    const created = await api()
      .post(itemsPath())
      .set("Cookie", cookie)
      .send({ description: " Logo design ", unitPrice: 15000 })
      .expect(201);
    expect(created.body).toMatchObject({
      description: "Logo design",
      quantity: "1.00",
      unitPrice: "15000.00",
      useCount: 0,
      archivedAt: null,
    });

    const edited = await api()
      .patch(`${itemsPath()}/${created.body.id}`)
      .set("Cookie", cookie)
      .send({ unitPrice: "18000" })
      .expect(200);
    expect(edited.body.unitPrice).toBe("18000.00");

    await api().post(`${itemsPath()}/${created.body.id}/archive`).set("Cookie", cookie).expect(200);
    expect(await list(cookie, itemsPath())).toEqual([]);
    expect(await list(cookie, `${itemsPath()}?status=archived`)).toHaveLength(1);
  });

  it("rejects a second active item with the same description", async () => {
    const { cookie, itemsPath, save } = await setup();
    await save("Hosting");
    const response = await api()
      .post(itemsPath())
      .set("Cookie", cookie)
      .send({ description: "hosting", unitPrice: "500" })
      .expect(400);
    expect(response.body.issues).toEqual([
      { path: "description", message: "You already saved an item with this description" },
    ]);
  });

  it("caps Free accounts at 5 active items across businesses", async () => {
    const { cookie, itemsPath, save } = await setup();
    const second = await createExtraBusiness(app, cookie, { displayName: "Second" });
    const first = await save("Item 1");
    for (const n of [2, 3, 4]) await save(`Item ${n}`);
    await save("Item 5", "1000", second);

    const blocked = await api()
      .post(itemsPath())
      .set("Cookie", cookie)
      .send({ description: "Item 6", unitPrice: "1000" })
      .expect(409);
    expect(blocked.body.code).toBe("SAVED_ITEM_LIMIT");

    await api().post(`${itemsPath()}/${first.id}/archive`).set("Cookie", cookie).expect(200);
    await save("Item 6");
  });

  it("lets Pro accounts save more than 5", async () => {
    const { email, save } = await setup();
    await makePro(app, email);
    for (const n of [1, 2, 3, 4, 5, 6]) await save(`Pro item ${n}`);
  });

  it("returns 404 for another account's items", async () => {
    const owner = await setup();
    const item = await owner.save("Private");
    const other = await setup();
    await api()
      .patch(`${other.itemsPath()}/${item.id}`)
      .set("Cookie", other.cookie)
      .send({ unitPrice: "1" })
      .expect(404);
    await api().get(owner.itemsPath()).set("Cookie", other.cookie).expect(404);
  });

  it("counts a use once per document and ranks by use", async () => {
    const { cookie, businessId, itemsPath, save } = await setup();
    const clientId = await createClient(app, cookie, businessId);
    const logo = await save("Logo design", "15000");
    const menu = await save("Menu design", "8000");
    const invoicePath = `/api/v1/businesses/${businessId}/invoices`;
    const line = (savedItemId: string, description: string) => ({
      description,
      quantity: "1",
      unitPrice: "100",
      savedItemId,
    });
    const body = (items: unknown[]) => ({
      clientId,
      issueDate: today,
      dueDate: addCalendarDays(today, 14),
      items,
    });

    const invoice = await api()
      .post(invoicePath)
      .set("Cookie", cookie)
      .send(body([line(menu.id, "Menu design")]))
      .expect(201);
    expect(invoice.body.items[0].savedItemId).toBe(menu.id);

    // Re-saving the same draft does not count again; adding a new link does.
    await api()
      .put(`${invoicePath}/${invoice.body.id}`)
      .set("Cookie", cookie)
      .send(body([line(menu.id, "Menu design"), line(logo.id, "Logo design")]))
      .expect(200);

    await api()
      .post(`/api/v1/businesses/${businessId}/quotes`)
      .set("Cookie", cookie)
      .send({
        clientId,
        issueDate: today,
        validUntil: addCalendarDays(today, 14),
        items: [line(menu.id, "Menu design")],
      })
      .expect(201);

    const ranked = await list(cookie, itemsPath());
    expect(ranked.map((item) => [item.description, item.useCount])).toEqual([
      ["Menu design", 2],
      ["Logo design", 1],
    ]);
  });

  it("drops links to another business's saved items", async () => {
    const owner = await setup();
    const foreign = await owner.save("Foreign");
    const { cookie, businessId } = await setup();
    const clientId = await createClient(app, cookie, businessId);
    const invoice = await api()
      .post(`/api/v1/businesses/${businessId}/invoices`)
      .set("Cookie", cookie)
      .send({
        clientId,
        issueDate: today,
        dueDate: addCalendarDays(today, 14),
        items: [{ description: "Foreign", quantity: "1", unitPrice: "1", savedItemId: foreign.id }],
      })
      .expect(201);
    expect(invoice.body.items[0].savedItemId).toBeNull();
    expect((await list(owner.cookie, owner.itemsPath()))[0]!.useCount).toBe(0);
  });
});
