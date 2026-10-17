import { Module } from "@nestjs/common";
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
})
export class AppModule {}
