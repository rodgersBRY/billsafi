import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureApp } from "../../src/app.setup.js";
import { loadRootEnvFile } from "../../src/config/env-file.js";
import { FakeMpesaProvider } from "../../src/billing/mpesa/fake.provider.js";
import { MPESA_PROVIDER } from "../../src/billing/mpesa/mpesa.provider.js";
import { MAILER } from "../../src/mail/mail.module.js";
import type { Mailer, MailMessage } from "../../src/mail/mailer.js";

loadRootEnvFile();
// Tests never call Safaricom or run background jobs; they drive billing directly.
process.env.MPESA_ENV = "fake";
process.env.MPESA_CALLBACK_TOKEN = "e2e-callback-token-0123456789";
process.env.BILLING_JOBS = "off";
// A pinned rate keeps charges predictable: USD 4 is KES 500, USD 2 is KES 250.
process.env.USD_KES_RATE = "125";
// Turns Google sign-in on; the Google spec stubs Google's token endpoint.
process.env.GOOGLE_CLIENT_ID = "e2e-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "e2e-google-client-secret";
// The one email the admin spec treats as an admin.
process.env.ADMIN_EMAILS = "admin@billsafi.test";

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
  const mpesa = new FakeMpesaProvider({ autoSettleMs: null });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(MPESA_PROVIDER)
    .useValue(mpesa)
    .compile();
  const app: INestApplication = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app, { WEB_ORIGIN });
  await app.init();
  return { app, mailer, mpesa };
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

export const sampleBusiness = {
  profileType: "individual",
  displayName: "Wanjiku Designs",
  contactEmail: "hello@wanjiku.example.test",
  phone: "0712 345 678",
};

/** Creates a business for the session and returns its id. */
export async function createBusiness(
  app: INestApplication,
  cookie: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/businesses")
    .set("Cookie", cookie)
    .send({ ...sampleBusiness, ...overrides })
    .expect(201);
  return response.body.id;
}

export const sampleClient = {
  name: "Acacia Creative",
  phone: "0722 111 222",
  email: "accounts@acacia.example.test",
};

export async function createClient(
  app: INestApplication,
  cookie: string,
  businessId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post(`/api/v1/businesses/${businessId}/clients`)
    .set("Cookie", cookie)
    .send({ ...sampleClient, ...overrides })
    .expect(201);
  return response.body.id;
}
