import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SentryGlobalFilter, SentryModule } from "@sentry/nestjs/setup";
import type { DatabaseConnection } from "@billsafi/db";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { createAuth } from "./auth/auth.js";
import { AuthProvidersModule } from "./auth/auth-providers.module.js";
import { SessionGuard } from "./auth/session.guard.js";
import { ConfigModule, ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";
import { DATABASE, DatabaseModule } from "./database/database.module.js";
import { ActivityRecorder } from "./activity/activity-recorder.js";
import { ActivityModule } from "./activity/activity.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { BusinessesModule } from "./businesses/businesses.module.js";
import { ClientsModule } from "./clients/clients.module.js";
import { GuestInvoicesModule } from "./guest-invoices/guest-invoices.module.js";
import { HealthModule } from "./health/health.module.js";
import { InvoicesModule } from "./invoices/invoices.module.js";
import { MAILER, MailModule } from "./mail/mail.module.js";
import { PlatformModule } from "./platform/platform.module.js";
import { ProductToursModule } from "./product-tours/product-tours.module.js";
import type { Mailer } from "./mail/mailer.js";

@Module({
  imports: [
    // Without a DSN (local, tests) the SDK is not initialised and reports nothing.
    SentryModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    ActivityModule,
    MailModule,
    AuditModule,
    // Registers Better Auth routes under /api/v1/auth. The global guard is SessionGuard
    // below: every route requires a session unless marked @AllowAnonymous().
    AuthModule.forRootAsync({
      inject: [DATABASE, ENV, MAILER, ActivityRecorder],
      useFactory: (
        connection: DatabaseConnection,
        env: Env,
        mailer: Mailer,
        recorder: ActivityRecorder,
      ) => ({
        auth: createAuth({ db: connection.db, env, mailer, recorder }),
        // CORS is configured once in app.setup.ts.
        disableTrustedOriginsCors: true,
      }),
      disableGlobalAuthGuard: true,
    }),
    AuthProvidersModule,
    HealthModule,
    BusinessesModule,
    ClientsModule,
    InvoicesModule,
    GuestInvoicesModule,
    BillingModule,
    ProductToursModule,
    PlatformModule,
    AdminModule,
  ],
  // Reports unexpected errors; HTTP errors such as 404 and 409 are not sent.
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    // Better Auth's guard, but suspended accounts count as signed out.
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
