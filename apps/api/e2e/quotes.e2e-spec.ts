import type { INestApplication } from "@nestjs/common";
import { and, type DatabaseConnection, eq, schema } from "@billsafi/db";
import { addCalendarDays, nairobiDate } from "@billsafi/domain";
import request from "supertest";
import { ActivityRecorder } from "../src/activity/activity-recorder.js";
import { DATABASE } from "../src/database/database.module.js";
import { type Mailer, RecordingMailer } from "../src/mail/mailer.js";
import {
  CapturingMailer,
  createBusiness,
  createClient,
  createTestApp,
  sampleBusiness,
  signUp,
} from "./support/app.js";

const today = nairobiDate(new Date());

const quoteBody = (clientId: string, overrides: Record<string, unknown> = {}) => ({
  clientId,
  issueDate: today,
  validUntil: addCalendarDays(today, 14),
  items: [
    { description: "Logo design", quantity: "1", unitPrice: "15000" },
    { description: "Menu design", quantity: "1", unitPrice: "8000" },
  ],
  discount: { type: "percentage", value: "10" },
  ...overrides,
});

describe("quotes", () => {
  let app: INestApplication;
  let mailer: CapturingMailer;
  let db: DatabaseConnection["db"];
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
    db = app.get<DatabaseConnection>(DATABASE).db;
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const { cookie } = await signUp(app);
    const businessId = await createBusiness(app, cookie);
    const clientId = await createClient(app, cookie, businessId);
    const path = `/api/v1/businesses/${businessId}/quotes`;
    const draft = async (overrides: Record<string, unknown> = {}) =>
      (
        await api()
          .post(path)
          .set("Cookie", cookie)
          .send(quoteBody(clientId, overrides))
          .expect(201)
      ).body as { id: string };
    const send = async (quoteId: string) =>
      (await api().post(`${path}/${quoteId}/send`).set("Cookie", cookie).expect(200)).body as {
        quote: { quoteNumber: string; version: number; status: string };
        link: { token: string } | null;
      };
    const sentQuote = async (overrides: Record<string, unknown> = {}) => {
      const { id } = await draft(overrides);
      const sent = await send(id);
      return { id, token: sent.link!.token, sent };
    };
    const pub = (token: string) => `/api/v1/public/quotes/${token}`;
    return { cookie, businessId, clientId, path, draft, send, sentQuote, pub };
  }

  it("numbers on first send, saves version 1 and returns a link once", async () => {
    const { path, cookie, draft, send } = await setup();
    const first = await draft();
    const sent = await send(first.id);
    expect(sent.quote).toMatchObject({ quoteNumber: "QT-00001", version: 1, status: "sent" });
    expect(sent.link?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const again = await send(first.id);
    expect(again.link).toBeNull();
    expect(again.quote.version).toBe(1);

    const second = await draft();
    expect((await send(second.id)).quote.quoteNumber).toBe("QT-00002");

    const list = await api().get(path).set("Cookie", cookie).expect(200);
    expect(list.body).toHaveLength(2);
  });

  it("does not use invoice allowance or invoice numbers", async () => {
    const { cookie, sentQuote } = await setup();
    await sentQuote();
    const usage = await api().get("/api/v1/usage").set("Cookie", cookie).expect(200);
    expect(usage.body.used).toBe(0);
  });

  it("saves a new version when a sent quote's content changes and shows it on the same link", async () => {
    const { path, cookie, clientId, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    const save = (overrides: Record<string, unknown>) =>
      api()
        .put(`${path}/${id}`)
        .set("Cookie", cookie)
        .send(quoteBody(clientId, overrides))
        .expect(200);

    expect((await save({})).body.version).toBe(1);
    const edited = await save({
      items: [{ description: "Logo design", quantity: "1", unitPrice: "12000" }],
    });
    expect(edited.body.version).toBe(2);
    expect(edited.body.versions).toHaveLength(2);

    const view = await api().get(pub(token)).expect(200);
    expect(view.body.subtotal).toBe("12000.00");
    expect(view.body.updatedAt).not.toBeNull();

    const v1 = await api().get(`${path}/${id}/versions/1`).set("Cookie", cookie).expect(200);
    expect(v1.body.content.subtotal).toBe("23000.00");
  });

  it("records an acceptance tied to the version and locks the quote", async () => {
    const { path, cookie, clientId, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    const accepted = await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true })
      .expect(200);
    expect(accepted.body).toMatchObject({
      status: "accepted",
      acceptedBy: { name: "Otieno Ouma" },
    });

    const quote = await api().get(`${path}/${id}`).set("Cookie", cookie).expect(200);
    expect(quote.body.response).toMatchObject({
      decision: "accepted",
      signerName: "Otieno Ouma",
      version: 1,
    });

    const locked = await api()
      .put(`${path}/${id}`)
      .set("Cookie", cookie)
      .send(quoteBody(clientId))
      .expect(409);
    expect(locked.body.code).toBe("QUOTE_LOCKED");

    const emails = mailer.sent.filter(
      (m) => m.to === sampleBusiness.contactEmail && m.subject.includes("accepted quote QT-00001"),
    );
    expect(emails).toHaveLength(1);
  });

  it("lets only one of two simultaneous accepts through", async () => {
    const { sentQuote, pub } = await setup();
    const { token } = await sentQuote();
    const responses = await Promise.all(
      [1, 2].map(() =>
        api()
          .post(`${pub(token)}/accept`)
          .send({ name: "Otieno Ouma", agreed: true }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.code).toBe("QUOTE_ALREADY_RESPONDED");
  });

  it("refuses answers after expiry and works again once the date is extended", async () => {
    const { path, cookie, clientId, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    await db
      .update(schema.quotes)
      .set({ issueDate: "2026-01-01", validUntil: "2026-01-15" })
      .where(eq(schema.quotes.id, id));

    const view = await api().get(pub(token)).expect(200);
    expect(view.body.expired).toBe(true);
    const refused = await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno", agreed: true })
      .expect(409);
    expect(refused.body.code).toBe("QUOTE_EXPIRED");

    const list = await api().get(`${path}?status=expired`).set("Cookie", cookie).expect(200);
    expect(list.body.map((q: { id: string }) => q.id)).toEqual([id]);

    await api()
      .put(`${path}/${id}`)
      .set("Cookie", cookie)
      .send(quoteBody(clientId, { validUntil: addCalendarDays(today, 7) }))
      .expect(200);
    await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true })
      .expect(200);
  });

  it("keeps a decline and a later accept after the quote is edited and resent", async () => {
    const { path, cookie, clientId, sentQuote, send, pub } = await setup();
    const { id, token } = await sentQuote();
    await api()
      .post(`${pub(token)}/decline`)
      .send({ reason: "Too expensive" })
      .expect(200);
    expect(mailer.lastTo(sampleBusiness.contactEmail)?.text).toContain(
      'Their reason: "Too expensive"',
    );

    await api()
      .put(`${path}/${id}`)
      .set("Cookie", cookie)
      .send(quoteBody(clientId, { discount: { type: "percentage", value: "20" } }))
      .expect(200);
    const resent = await send(id);
    expect(resent.quote).toMatchObject({ status: "sent", version: 2 });
    expect(resent.link).toBeNull();

    await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true })
      .expect(200);
    const rows = await db
      .select()
      .from(schema.quoteAcceptances)
      .where(eq(schema.quoteAcceptances.quoteId, id));
    expect(rows.map((r) => r.decision).sort()).toEqual(["accepted", "declined"]);
  });

  it("closes the link when a quote is withdrawn", async () => {
    const { path, cookie, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    await api().post(`${path}/${id}/withdraw`).set("Cookie", cookie).expect(200);
    const gone = await api().get(pub(token)).expect(404);
    expect(gone.body.code).toBe("QUOTE_UNAVAILABLE");
  });

  it("converts an accepted quote into one draft invoice without using allowance", async () => {
    const { businessId, path, cookie, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true })
      .expect(200);

    const converted = await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);
    const invoicePath = `/api/v1/businesses/${businessId}/invoices/${converted.body.invoiceId}`;
    const invoice = await api().get(invoicePath).set("Cookie", cookie).expect(200);
    expect(invoice.body).toMatchObject({
      status: "draft",
      total: "20700.00",
      issueDate: today,
      dueDate: addCalendarDays(today, 14),
      sourceQuote: { id, quoteNumber: "QT-00001" },
    });
    expect(invoice.body.items.map((i: { description: string }) => i.description)).toEqual([
      "Logo design",
      "Menu design",
    ]);
    expect((await api().get("/api/v1/usage").set("Cookie", cookie).expect(200)).body.used).toBe(0);

    const again = await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({})
      .expect(200);
    expect(again.body.invoiceId).toBe(converted.body.invoiceId);

    await api().delete(invoicePath).set("Cookie", cookie).expect(204);
    const quote = await api().get(`${path}/${id}`).set("Cookie", cookie).expect(200);
    expect(quote.body).toMatchObject({ status: "accepted", convertedInvoiceId: null });
  });

  it("needs confirmation to convert a quote the client hasn't accepted", async () => {
    const { path, cookie, sentQuote } = await setup();
    const { id } = await sentQuote();
    const refused = await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({})
      .expect(400);
    expect(refused.body.issues[0].path).toBe("confirmUnaccepted");
    await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({ confirmUnaccepted: true })
      .expect(200);
  });

  it("hides another business's quotes", async () => {
    const owner = await setup();
    const { id } = await owner.sentQuote();
    const other = await setup();
    const foreign = `${other.path}/${id}`;
    await api().get(foreign).set("Cookie", other.cookie).expect(404);
    await api()
      .put(foreign)
      .set("Cookie", other.cookie)
      .send(quoteBody(other.clientId))
      .expect(404);
    await api().post(`${foreign}/send`).set("Cookie", other.cookie).expect(404);
    await api().post(`${foreign}/withdraw`).set("Cookie", other.cookie).expect(404);
    await api()
      .post(`${foreign}/convert`)
      .set("Cookie", other.cookie)
      .send({ confirmUnaccepted: true })
      .expect(404);
    await api().get(`${foreign}/pdf`).set("Cookie", other.cookie).expect(404);
    await api().delete(foreign).set("Cookie", other.cookie).expect(404);
    await api().post(`${foreign}/duplicate`).set("Cookie", other.cookie).expect(404);
    await api().get(`${foreign}/versions/1`).set("Cookie", other.cookie).expect(404);
    await api().get(`${foreign}/link`).set("Cookie", other.cookie).expect(404);
    await api().post(`${foreign}/link`).set("Cookie", other.cookie).expect(404);
    await api().delete(`${foreign}/link`).set("Cookie", other.cookie).expect(404);
    // The owner's link is untouched.
    await api().get(`${owner.path}/${id}/link`).set("Cookie", owner.cookie).expect(200);
  });

  it("only deletes drafts and duplicates any quote as a new draft", async () => {
    const { path, cookie, draft, sentQuote } = await setup();
    const { id } = await sentQuote();
    await api().delete(`${path}/${id}`).set("Cookie", cookie).expect(409);
    const copy = await api().post(`${path}/${id}/duplicate`).set("Cookie", cookie).expect(201);
    expect(copy.body).toMatchObject({ status: "draft", quoteNumber: null, version: null });
    const plain = await draft();
    await api().delete(`${path}/${plain.id}`).set("Cookie", cookie).expect(204);
  });

  it("serves a PDF to the freelancer and on the public link", async () => {
    const { path, cookie, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    const own = await api().get(`${path}/${id}/pdf`).set("Cookie", cookie).expect(200);
    expect(own.headers["content-type"]).toContain("application/pdf");
    const shared = await api()
      .get(`${pub(token)}/pdf`)
      .expect(200);
    expect(shared.headers["content-disposition"]).toContain("QT-00001.pdf");
  });

  it("records a failed notification email without undoing the answer", async () => {
    const { path, cookie, businessId, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    const [business] = await db
      .select({ ownerId: schema.businesses.ownerUserId })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId));
    const recorder = app.get(ActivityRecorder);
    const original = mailer.send.bind(mailer);
    const failing = new RecordingMailer(
      {
        send: async () => {
          throw new Error("SMTP down");
        },
      },
      recorder,
    );
    (mailer as { send: Mailer["send"] }).send = (message, context) =>
      failing.send(message, context);
    try {
      await api()
        .post(`${pub(token)}/accept`)
        .send({ name: "Otieno Ouma", agreed: true })
        .expect(200);
    } finally {
      mailer.send = original;
    }
    const quote = await api().get(`${path}/${id}`).set("Cookie", cookie).expect(200);
    expect(quote.body.status).toBe("accepted");
    await recorder.flush();
    const failures = await db
      .select()
      .from(schema.operationFailures)
      .where(
        and(
          eq(schema.operationFailures.operation, "quote_response_email"),
          eq(schema.operationFailures.accountId, business!.ownerId),
        ),
      );
    expect(failures).toHaveLength(1);
  });

  it("answers 404 for malformed tokens and closed links", async () => {
    const { path, cookie, sentQuote, pub } = await setup();
    const malformed = await api().get(pub("not-a-token")).expect(404);
    expect(malformed.body.code).toBe("QUOTE_UNAVAILABLE");

    const { id, token } = await sentQuote();
    await api().delete(`${path}/${id}/link`).set("Cookie", cookie).expect(204);
    await api().get(pub(token)).expect(404);
    await api()
      .get(`${pub(token)}/pdf`)
      .expect(404);
    await api()
      .get(`${pub(token)}/logo`)
      .expect(404);
  });

  it("does not serve a withdrawn quote's PDF and refuses a draft PDF to the owner", async () => {
    const { path, cookie, draft, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    await api().post(`${path}/${id}/withdraw`).set("Cookie", cookie).expect(200);
    await api()
      .get(`${pub(token)}/pdf`)
      .expect(404);

    const { id: draftId } = await draft();
    await api().get(`${path}/${draftId}/pdf`).set("Cookie", cookie).expect(409);
  });

  it("refuses to convert drafts and withdrawn quotes", async () => {
    const { path, cookie, draft, sentQuote } = await setup();
    const { id: draftId } = await draft();
    await api()
      .post(`${path}/${draftId}/convert`)
      .set("Cookie", cookie)
      .send({ confirmUnaccepted: true })
      .expect(409);
    const { id } = await sentQuote();
    await api().post(`${path}/${id}/withdraw`).set("Cookie", cookie).expect(200);
    await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({ confirmUnaccepted: true })
      .expect(409);
  });

  it("leaves the quote accepted and creates no invoice when the client is archived", async () => {
    const { businessId, clientId, path, cookie, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true })
      .expect(200);
    await api()
      .post(`/api/v1/businesses/${businessId}/clients/${clientId}/archive`)
      .set("Cookie", cookie)
      .expect(200);
    const refused = await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({})
      .expect(400);
    expect(refused.body.issues[0].path).toBe("clientId");
    const quote = await api().get(`${path}/${id}`).set("Cookie", cookie).expect(200);
    expect(quote.body).toMatchObject({ status: "accepted", convertedInvoiceId: null });
    const invoices = await api()
      .get(`/api/v1/businesses/${businessId}/invoices`)
      .set("Cookie", cookie)
      .expect(200);
    expect(invoices.body).toHaveLength(0);
  });

  it("stores the client's address and browser with the acceptance", async () => {
    const { sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    await api()
      .post(`${pub(token)}/accept`)
      .set("User-Agent", "QuoteTest/1.0")
      .send({ name: "Otieno Ouma", agreed: true })
      .expect(200);
    const [row] = await db
      .select()
      .from(schema.quoteAcceptances)
      .where(eq(schema.quoteAcceptances.quoteId, id));
    expect(row?.ip).toBeTruthy();
    expect(row?.userAgent).toBe("QuoteTest/1.0");
  });

  it("refuses an answer given on a version that has since changed", async () => {
    const { path, cookie, clientId, sentQuote, pub } = await setup();
    const { id, token } = await sentQuote();
    const view = await api().get(pub(token)).expect(200);
    expect(view.body.version).toBe(1);
    await api()
      .put(`${path}/${id}`)
      .set("Cookie", cookie)
      .send(quoteBody(clientId, { discount: { type: "percentage", value: "20" } }))
      .expect(200);

    const stale = await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true, version: 1 })
      .expect(409);
    expect(stale.body.code).toBe("QUOTE_CHANGED");
    await api().get(pub(token)).expect(200);
    const current = await api().get(pub(token)).expect(200);
    expect(current.body.version).toBe(2);
    await api()
      .post(`${pub(token)}/accept`)
      .send({ name: "Otieno Ouma", agreed: true, version: 2 })
      .expect(200);
  });

  it("returns an unaccepted converted quote to sent when its draft is deleted", async () => {
    const { businessId, path, cookie, sentQuote } = await setup();
    const { id } = await sentQuote();
    const converted = await api()
      .post(`${path}/${id}/convert`)
      .set("Cookie", cookie)
      .send({ confirmUnaccepted: true })
      .expect(200);
    await api()
      .delete(`/api/v1/businesses/${businessId}/invoices/${converted.body.invoiceId}`)
      .set("Cookie", cookie)
      .expect(204);
    const quote = await api().get(`${path}/${id}`).set("Cookie", cookie).expect(200);
    expect(quote.body).toMatchObject({ status: "sent", convertedInvoiceId: null });
  });

  it("records quote_sent and quote_converted only when something changed", async () => {
    const { businessId, path, cookie, draft, send } = await setup();
    const [business] = await db
      .select({ ownerId: schema.businesses.ownerUserId })
      .from(schema.businesses)
      .where(eq(schema.businesses.id, businessId));
    const { id } = await draft();
    await send(id);
    await send(id);
    for (let i = 0; i < 2; i++) {
      await api()
        .post(`${path}/${id}/convert`)
        .set("Cookie", cookie)
        .send({ confirmUnaccepted: true })
        .expect(200);
    }
    await app.get(ActivityRecorder).flush();
    const count = async (name: string) =>
      (
        await db
          .select()
          .from(schema.productEvents)
          .where(
            and(
              eq(schema.productEvents.name, name),
              eq(schema.productEvents.accountId, business!.ownerId),
            ),
          )
      ).length;
    expect(await count("quote_converted")).toBe(1);
    expect(await count("quote_sent")).toBe(1);
  });

  it("counts sent, unexpired quotes on the dashboard", async () => {
    const { businessId, cookie, sentQuote, draft } = await setup();
    await sentQuote();
    await sentQuote();
    await draft();
    const dashboard = await api()
      .get(`/api/v1/businesses/${businessId}/dashboard`)
      .set("Cookie", cookie)
      .expect(200);
    expect(dashboard.body.openQuotes).toEqual({ count: 2, total: "41400.00" });
  });
});
