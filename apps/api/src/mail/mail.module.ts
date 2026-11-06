import { Global, Module } from "@nestjs/common";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { LogMailer, type Mailer, RecordingMailer, ResendMailer, SmtpMailer } from "./mailer.js";

export const MAILER = Symbol("MAILER");

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ENV, ActivityRecorder],
      useFactory: (env: Env, recorder: ActivityRecorder): Mailer =>
        new RecordingMailer(createMailer(env), recorder),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}

/** Env validation guarantees the key or URL the chosen driver needs (D070). */
export function createMailer(env: Env): Mailer {
  switch (env.MAIL_DRIVER) {
    case "log":
      return new LogMailer();
    case "resend":
      return new ResendMailer(env.RESEND_API_KEY!, env.MAIL_FROM);
    case "smtp":
      return new SmtpMailer(env.SMTP_URL!, env.MAIL_FROM);
  }
}
