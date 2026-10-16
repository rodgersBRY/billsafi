import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureApp } from "../../src/app.setup.js";
import { loadRootEnvFile } from "../../src/config/env-file.js";
import { MAILER } from "../../src/mail/mail.module.js";
import type { Mailer, MailMessage } from "../../src/mail/mailer.js";

loadRootEnvFile();

export const WEB_ORIGIN = "http://localhost:3000";

export class CapturingMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  lastTo(to: string): MailMessage | undefined {
    return this.sent.filter((message) => message.to === to).at(-1);
  }
}

export async function createTestApp() {
  const mailer = new CapturingMailer();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer)
    .compile();
  const app: INestApplication = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app, { WEB_ORIGIN });
  await app.init();
  return { app, mailer };
}

export function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID()}@example.test`;
}

/** Signs up a fresh account and returns its session cookie. */
export async function signUp(app: INestApplication, email = uniqueEmail("user")) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/sign-up/email")
    .set("Origin", WEB_ORIGIN)
    .send({ name: "Wanjiku Kamau", email, password: "correct-horse-battery" })
    .expect(200);
  return { email, cookie: sessionCookie(response.headers["set-cookie"]) };
}

export function sessionCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((cookie) => cookie.startsWith("better-auth.session_token="));
  if (!session) throw new Error("No session cookie in response");
  return session.split(";")[0]!;
}
