import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import type { DatabaseConnection } from "@billsafi/db";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureApp } from "../../src/app.setup.js";
import { loadRootEnvFile } from "../../src/config/env-file.js";
import { AdminRoleSyncService } from "../../src/admin/access/admin-role-sync.service.js";
import {
  ADMIN_ACTION_LIMITER,
  SlidingWindowLimiter,
} from "../../src/admin/shared/rate-limit.guard.js";
import { FakeMpesaProvider } from "../../src/billing/mpesa/fake.provider.js";
import { MPESA_PROVIDER } from "../../src/billing/mpesa/mpesa.provider.js";
import { MAILER } from "../../src/mail/mail.module.js";
import type { Mailer, MailMessage } from "../../src/mail/mailer.js";

loadRootEnvFile();
// Tests never call Safaricom or run background jobs; they drive billing directly.
process.env.MPESA_ENV = "fake";
process.env.MPESA_CALLBACK_TOKEN = "e2e-callback-token-0123456789";
process.env.BILLING_JOBS = "off";
process.env.MAINTENANCE_JOBS = "off";
// A pinned rate keeps charges predictable: USD 4 is KES 500, USD 2 is KES 250.
process.env.USD_KES_RATE = "125";
// Turns Google sign-in on; the Google spec stubs Google's token endpoint.
process.env.GOOGLE_CLIENT_ID = "e2e-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "e2e-google-client-secret";
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

/**
 * Spec files run in parallel against one database, and the admin role sync rewrites
 * users.role globally on start. It is off unless a spec asks for it, so one file's app
 * cannot demote another file's admin mid-run.
 */
export async function createTestApp({
  adminRoleSync = false,
  adminActionLimit,
  configure,
}: {
  adminRoleSync?: boolean;
  /** Admin actions allowed per minute; the app's own limit (10) when not given. */
  adminActionLimit?: number;
  /** Swaps providers, such as a recorder that cannot write or a PDF renderer that fails. */
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
} = {}) {
  const mailer = new CapturingMailer();
  const mpesa = new FakeMpesaProvider({ autoSettleMs: null });
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(MPESA_PROVIDER)
    .useValue(mpesa);
  if (!adminRoleSync) {
    builder = builder.overrideProvider(AdminRoleSyncService).useValue({});
  }
  if (adminActionLimit !== undefined) {
    builder = builder
      .overrideProvider(ADMIN_ACTION_LIMITER)
      .useValue(new SlidingWindowLimiter(adminActionLimit, 60_000));
  }
  if (configure) builder = configure(builder);
  const moduleRef = await builder.compile();
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

/**
 * Drops a throwaway database once the closed app's connections have really gone. A pool can
 * finish `end()` while its sessions are still closing on the server; forcing the drop then
 * kills them mid-close and the client raises an unhandled 57P01 error that fails the run.
 */
export async function dropThrowawayDatabase(admin: Pick<DatabaseConnection, "pool">, name: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { rows } = await admin.pool.query<{ open: number }>(
      "select count(*)::int as open from pg_stat_activity where datname = $1",
      [name],
    );
    if (rows[0]!.open === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await admin.pool.query(`drop database if exists "${name}" with (force)`);
}
