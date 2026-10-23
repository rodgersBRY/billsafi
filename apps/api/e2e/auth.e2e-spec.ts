import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  type CapturingMailer,
  createTestApp,
  sessionCookie,
  signUp,
  uniqueEmail,
  WEB_ORIGIN,
} from "./support/app.js";

describe("authentication", () => {
  let app: INestApplication;
  let mailer: CapturingMailer;

  beforeAll(async () => {
    ({ app, mailer } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("signs up without email verification and returns a session", async () => {
    const { email, cookie } = await signUp(app);

    const session = await request(app.getHttpServer())
      .get("/api/v1/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);

    expect(session.body.user).toMatchObject({ email, name: "Wanjiku Kamau" });
  });

  it("serves Better Auth under /api/v1/auth", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/ok").expect(200);
  });

  it("emails a one-hour reset link and signs out every session after reset", async () => {
    const { email, cookie: firstDevice } = await signUp(app);
    const secondDevice = sessionCookie(
      (
        await request(app.getHttpServer())
          .post("/api/v1/auth/sign-in/email")
          .set("Origin", WEB_ORIGIN)
          .send({ email, password: "correct-horse-battery" })
          .expect(200)
      ).headers["set-cookie"],
    );

    await request(app.getHttpServer())
      .post("/api/v1/auth/request-password-reset")
      .set("Origin", WEB_ORIGIN)
      .send({ email, redirectTo: `${WEB_ORIGIN}/reset-password` })
      .expect(200);

    // Sending is fire-and-forget; give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const message = mailer.lastTo(email);
    expect(message?.subject).toBe("Reset your BillSafi password");
    const link = /(http\S+\/reset-password\/(\S+?)\?\S*)/.exec(message!.text);
    expect(link?.[1]).toContain(`${WEB_ORIGIN}/api/v1/auth/reset-password/`);
    const token = link![2]!;

    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .set("Origin", WEB_ORIGIN)
      .send({ token, newPassword: "a-brand-new-passphrase" })
      .expect(200);

    for (const cookie of [firstDevice, secondDevice]) {
      const session = await request(app.getHttpServer())
        .get("/api/v1/auth/get-session")
        .set("Cookie", cookie)
        .expect(200);
      expect(session.body).toBeNull();
    }

    await request(app.getHttpServer())
      .post("/api/v1/auth/sign-in/email")
      .set("Origin", WEB_ORIGIN)
      .send({ email, password: "a-brand-new-passphrase" })
      .expect(200);
  });

  it("does not reveal whether an email has an account", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/request-password-reset")
      .set("Origin", WEB_ORIGIN)
      .send({ email: uniqueEmail("nobody"), redirectTo: `${WEB_ORIGIN}/reset-password` })
      .expect(200);
  });
});
