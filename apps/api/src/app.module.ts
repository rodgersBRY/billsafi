import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import type { DatabaseConnection } from "@tallynest/db";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { createAuth } from "./auth/auth.js";
import { ConfigModule, ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";
import { DATABASE, DatabaseModule } from "./database/database.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { BusinessesModule } from "./businesses/businesses.module.js";
import { ClientsModule } from "./clients/clients.module.js";
import { HealthModule } from "./health/health.module.js";
import { InvoicesModule } from "./invoices/invoices.module.js";
import { MAILER, MailModule } from "./mail/mail.module.js";
import type { Mailer } from "./mail/mailer.js";

@Module({
  imports: [
    // Without a DSN (local, tests) the SDK is not initialised and reports nothing.
    SentryModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    MailModule,
    // Registers Better Auth routes under /api/v1/auth and a global guard:
    // every route requires a session unless marked @AllowAnonymous().
    AuthModule.forRootAsync({
      inject: [DATABASE, ENV, MAILER],
      useFactory: (connection: DatabaseConnection, env: Env, mailer: Mailer) => ({
        auth: createAuth({ db: connection.db, env, mailer }),
        // CORS is configured once in app.setup.ts.
        disableTrustedOriginsCors: true,
      }),
    }),
    HealthModule,
    BusinessesModule,
    ClientsModule,
    InvoicesModule,
    BillingModule,
  ],
  // Reports unexpected errors; HTTP errors such as 404 and 409 are not sent.
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}
