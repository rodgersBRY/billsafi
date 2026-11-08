import type { INestApplication } from "@nestjs/common";
import type { WhatsNewFeed } from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema, sql } from "@billsafi/db";
import request from "supertest";
import { DATABASE } from "../src/database/database.module.js";
import { createTestApp, signUp, uniqueEmail } from "./support/app.js";

const PREFIX = `e2e-${crypto.randomUUID().slice(0, 8)}`;
const HOUR = 3_600_000;

describe("what's new", () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;

  async function insertEntry(values: { title: string; publishedAt: Date | null; popup?: boolean }) {
    const [row] = await db()
      .insert(schema.whatsNewEntries)
      .values({ body: "Body text", ...values, title: `${PREFIX} ${values.title}` })
      .returning();
    return row!;
  }

  async function feed(cookie: string): Promise<WhatsNewFeed> {
    return (await api().get("/api/v1/whats-new").set("Cookie", cookie).expect(200)).body;
  }

  const mine = (body: WhatsNewFeed) => body.entries.filter((e) => e.title.startsWith(PREFIX));

  /** Marks the first-run tour as done, so the pop-up rule is not held back. */
  async function finishTour(cookie: string) {
    await api()
      .put("/api/v1/me/tours/first-run")
      .set("Cookie", cookie)
      .send({ version: 99, status: "completed" })
      .expect(200);
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    // Entries are global; leave none behind to crowd the newest-20 feed on later runs.
    await db()
      .delete(schema.whatsNewEntries)
      .where(sql`${schema.whatsNewEntries.title} like ${`${PREFIX}%`}`);
    await app.close();
  });

  it("requires a session", async () => {
    await api().get("/api/v1/whats-new").expect(401);
    await api().post("/api/v1/whats-new/seen").expect(401);
  });

  it("hides drafts and scheduled entries", async () => {
    await insertEntry({ title: "draft", publishedAt: null });
    await insertEntry({ title: "scheduled", publishedAt: new Date(Date.now() + HOUR) });
    const { cookie } = await signUp(app);
    const titles = mine(await feed(cookie)).map((entry) => entry.title);
    expect(titles).not.toContain(`${PREFIX} draft`);
    expect(titles).not.toContain(`${PREFIX} scheduled`);
  });

  it("lists entries from before sign-up as read", async () => {
    await insertEntry({ title: "old", publishedAt: new Date(Date.now() - HOUR), popup: true });
    const { cookie } = await signUp(app);
    await finishTour(cookie);
    const body = await feed(cookie);
    expect(mine(body).find((e) => e.title === `${PREFIX} old`)).toMatchObject({ unread: false });
    expect(body.popup).toBe(false);
  });

  it("counts new entries, pops up for flagged ones and clears on seen", async () => {
    const { cookie, email } = await signUp(app);
    await finishTour(cookie);
    // Move the account's sign-up into the past so the entries below are newer.
    await db()
      .update(schema.users)
      .set({ createdAt: new Date(Date.now() - 2 * HOUR) })
      .where(eq(schema.users.email, email));
    await insertEntry({ title: "quiet", publishedAt: new Date(Date.now() - HOUR) });
    await insertEntry({ title: "loud", publishedAt: new Date(Date.now() - HOUR / 2), popup: true });

    const before = await feed(cookie);
    // The "old" entry from an earlier test is also newer than this account, so pick ours by title.
    const ours = mine(before).filter((e) => /(loud|quiet)$/.test(e.title));
    expect(ours.filter((e) => e.unread)).toHaveLength(2);
    expect(before.unreadCount).toBeGreaterThanOrEqual(2);
    expect(before.popup).toBe(true);
    // Newest first, and the admin-only popup flag is not sent to users.
    expect(ours.map((e) => e.title)).toEqual([`${PREFIX} loud`, `${PREFIX} quiet`]);
    expect(ours[0]).not.toHaveProperty("popup");

    await api().post("/api/v1/whats-new/seen").set("Cookie", cookie).expect(204);
    const after = await feed(cookie);
    expect(after.unreadCount).toBe(0);
    expect(after.popup).toBe(false);
  });

  it("holds the pop-up back while the first-run tour is due", async () => {
    const { cookie, email } = await signUp(app);
    await db()
      .update(schema.users)
      .set({ createdAt: new Date(Date.now() - 2 * HOUR) })
      .where(eq(schema.users.email, email));
    await insertEntry({ title: "tour", publishedAt: new Date(Date.now() - HOUR), popup: true });
    const body = await feed(cookie);
    expect(body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(body.popup).toBe(false);
  });
});

describe("admin what's new", () => {
  let app: INestApplication;
  let adminCookie: string;
  let userCookie: string;
  const api = () => request(app.getHttpServer());
  const db = () => app.get<DatabaseConnection>(DATABASE).db;
  const REASON = "Feature shipped today";
  const entry = { title: `${PREFIX} admin`, body: "Made by an admin." };

  beforeAll(async () => {
    ({ app } = await createTestApp());
    const admin = await signUp(app, uniqueEmail("whats-new-admin"));
    await db()
      .update(schema.users)
      .set({ role: "admin" })
      .where(eq(schema.users.email, admin.email));
    adminCookie = admin.cookie;
    userCookie = (await signUp(app)).cookie;
  });

  afterAll(async () => {
    await db()
      .delete(schema.whatsNewEntries)
      .where(sql`${schema.whatsNewEntries.title} like ${`${PREFIX}%`}`);
    await app.close();
  });

  it("is a 404 for anyone who is not an admin", async () => {
    await api().get("/api/v1/admin/whats-new").set("Cookie", userCookie).expect(404);
    await api()
      .post("/api/v1/admin/whats-new")
      .set("Cookie", userCookie)
      .send({ ...entry, reason: REASON })
      .expect(404);
    await api().get("/api/v1/admin/whats-new").expect(404);
    await api()
      .post("/api/v1/admin/whats-new")
      .send({ ...entry, reason: REASON })
      .expect(404);
    const unknown = crypto.randomUUID();
    await api()
      .put(`/api/v1/admin/whats-new/${unknown}`)
      .set("Cookie", userCookie)
      .send({ ...entry, reason: REASON })
      .expect(404);
    await api()
      .post(`/api/v1/admin/whats-new/${unknown}/delete`)
      .set("Cookie", userCookie)
      .send({ reason: REASON })
      .expect(404);
  });

  it("needs a reason to delete", async () => {
    await api()
      .post(`/api/v1/admin/whats-new/${crypto.randomUUID()}/delete`)
      .set("Cookie", adminCookie)
      .send({})
      .expect(400);
  });

  it("needs a reason and valid fields", async () => {
    const bad = await api()
      .post("/api/v1/admin/whats-new")
      .set("Cookie", adminCookie)
      .send({ title: "", body: "x" })
      .expect(400);
    const paths = bad.body.issues.map((issue: { path: string }) => issue.path).sort();
    expect(paths).toEqual(["reason", "title"]);
  });

  it("creates a draft, publishes it, unpublishes it and deletes it, with audit rows", async () => {
    const created = await api()
      .post("/api/v1/admin/whats-new")
      .set("Cookie", adminCookie)
      .send({ ...entry, reason: REASON })
      .expect(201);
    expect(created.body).toMatchObject({ status: "draft", publishedAt: null, popup: false });
    const id: string = created.body.id;

    const publishedAt = new Date(Date.now() - 60_000).toISOString();
    const published = await api()
      .put(`/api/v1/admin/whats-new/${id}`)
      .set("Cookie", adminCookie)
      .send({ ...entry, popup: true, publishedAt, reason: REASON })
      .expect(200);
    expect(published.body).toMatchObject({ status: "live", popup: true });

    const listed = await api()
      .get("/api/v1/admin/whats-new")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(listed.body.entries.map((e: { id: string }) => e.id)).toContain(id);

    await api()
      .put(`/api/v1/admin/whats-new/${id}`)
      .set("Cookie", adminCookie)
      .send({ ...entry, popup: true, publishedAt, reason: REASON })
      .expect(409);

    const unpublished = await api()
      .put(`/api/v1/admin/whats-new/${id}`)
      .set("Cookie", adminCookie)
      .send({ ...entry, popup: true, reason: REASON })
      .expect(200);
    expect(unpublished.body).toMatchObject({ status: "draft", publishedAt: null });

    await api()
      .post(`/api/v1/admin/whats-new/${id}/delete`)
      .set("Cookie", adminCookie)
      .send({ reason: REASON })
      .expect(201);
    await api()
      .post(`/api/v1/admin/whats-new/${id}/delete`)
      .set("Cookie", adminCookie)
      .send({ reason: REASON })
      .expect(404);

    const audit = await db()
      .select({ action: schema.auditLogs.action, outcome: schema.auditLogs.outcome })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.targetId, id));
    expect(audit).toEqual(
      expect.arrayContaining([
        { action: "whats_new.create", outcome: "success" },
        { action: "whats_new.update", outcome: "success" },
        { action: "whats_new.delete", outcome: "success" },
        { action: "whats_new.delete", outcome: "failure" },
      ]),
    );
    const updates = audit.filter((row) => row.action === "whats_new.update");
    expect(updates).toEqual([
      { action: "whats_new.update", outcome: "success" },
      { action: "whats_new.update", outcome: "success" },
    ]);
  });

  it("is a 404 for an unknown or malformed id", async () => {
    await api()
      .put(`/api/v1/admin/whats-new/${crypto.randomUUID()}`)
      .set("Cookie", adminCookie)
      .send({ ...entry, reason: REASON })
      .expect(404);
    await api()
      .put("/api/v1/admin/whats-new/not-a-uuid")
      .set("Cookie", adminCookie)
      .send({ ...entry, reason: REASON })
      .expect(404);
  });
});
