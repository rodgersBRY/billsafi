import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, signUp } from "./support/app.js";

/** Builds an app whose admin list is fixed at start-up, so it must be set first. */
async function appWithAdmins(ids: string): Promise<INestApplication> {
  const previous = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = ids;
  try {
    return (await createTestApp()).app;
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = previous;
  }
}

describe("GET /api/v1/admin/ping", () => {
  let app: INestApplication;
  let adminCookie: string;

  beforeAll(async () => {
    // A user's ID is only known after sign-up, so make the admin first.
    const setup = (await createTestApp()).app;
    const { cookie } = await signUp(setup);
    adminCookie = cookie;
    const session = await request(setup.getHttpServer())
      .get("/api/v1/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);
    const adminId: string = session.body.user.id;
    await setup.close();
    app = await appWithAdmins(adminId);
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
    await request(app.getHttpServer())
      .get("/api/v1/admin/ping")
      .set("Cookie", adminCookie)
      .expect(200, { ok: true });
  });

  it("turns admin off for everyone when the list is empty", async () => {
    const closed = await appWithAdmins("");
    try {
      await request(closed.getHttpServer())
        .get("/api/v1/admin/ping")
        .set("Cookie", adminCookie)
        .expect(404);
    } finally {
      await closed.close();
    }
  });
});
