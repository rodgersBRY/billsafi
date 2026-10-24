import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { WEB_ORIGIN, createTestApp, sessionCookie, signUp } from "./support/app.js";

const ADMIN_EMAIL = "admin@billsafi.test";
const PASSWORD = "correct-horse-battery";

/** Signs up the admin account, or signs in when an earlier run already made it. */
async function adminCookie(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/sign-in/email")
    .set("Origin", WEB_ORIGIN)
    .send({ email: ADMIN_EMAIL, password: PASSWORD });
  if (response.status === 200) return sessionCookie(response.headers["set-cookie"]);
  return (await signUp(app, ADMIN_EMAIL)).cookie;
}

describe("GET /api/v1/admin/ping", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers 404 to a signed-out visitor", async () => {
    await request(app.getHttpServer()).get("/api/v1/admin/ping").expect(404);
  });

  it("answers 404 to a signed-in user who is not an admin", async () => {
    const { cookie } = await signUp(app);
    await request(app.getHttpServer()).get("/api/v1/admin/ping").set("Cookie", cookie).expect(404);
  });

  it("looks the same as an unknown route", async () => {
    const unknown = await request(app.getHttpServer()).get("/api/v1/admin/nothing");
    const guarded = await request(app.getHttpServer()).get("/api/v1/admin/ping");
    expect(Object.keys(guarded.body).sort()).toEqual(Object.keys(unknown.body).sort());
    expect(guarded.body.error).toBe(unknown.body.error);
  });

  it("lets a listed admin in", async () => {
    const cookie = await adminCookie(app);
    await request(app.getHttpServer())
      .get("/api/v1/admin/ping")
      .set("Cookie", cookie)
      .expect(200, { ok: true });
  });

  it("turns admin off for everyone when the list is empty", async () => {
    const cookie = await adminCookie(app);
    const previous = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "";
    let closed: INestApplication | undefined;
    try {
      ({ app: closed } = await createTestApp());
    } finally {
      process.env.ADMIN_EMAILS = previous;
    }
    try {
      await request(closed.getHttpServer())
        .get("/api/v1/admin/ping")
        .set("Cookie", cookie)
        .expect(404);
    } finally {
      await closed.close();
    }
  });
});
