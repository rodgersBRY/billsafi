import { Global, Module } from "@nestjs/common";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { type Mailer, SmtpMailer } from "./mailer.js";

export const MAILER = Symbol("MAILER");

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ENV],
      useFactory: (env: Env): Mailer => new SmtpMailer(env.SMTP_URL, env.MAIL_FROM),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
