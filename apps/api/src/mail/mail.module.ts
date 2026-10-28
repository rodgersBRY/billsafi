import { Global, Module } from "@nestjs/common";
import { ActivityRecorder } from "../activity/activity-recorder.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { type Mailer, RecordingMailer, SmtpMailer } from "./mailer.js";

export const MAILER = Symbol("MAILER");

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ENV, ActivityRecorder],
      useFactory: (env: Env, recorder: ActivityRecorder): Mailer =>
        new RecordingMailer(
          new SmtpMailer(
            env.RESEND_API_KEY
              ? `smtps://resend:${encodeURIComponent(env.RESEND_API_KEY)}@smtp.resend.com:465`
              : env.SMTP_URL!,
            env.MAIL_FROM,
          ),
          recorder,
        ),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
