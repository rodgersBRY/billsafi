import { Module } from "@nestjs/common";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { AllowanceService } from "./allowance.service.js";
import { BillingController, MpesaCallbackController } from "./billing.controller.js";
import { BillingJobs } from "./billing.jobs.js";
import { BillingService } from "./billing.service.js";
import { DarajaMpesaProvider } from "./mpesa/daraja.provider.js";
import { FakeMpesaProvider } from "./mpesa/fake.provider.js";
import {
  DisabledMpesaProvider,
  MPESA_PROVIDER,
  type MpesaProvider,
} from "./mpesa/mpesa.provider.js";

export function createMpesaProvider(env: Env): MpesaProvider {
  if (env.MPESA_ENV === "fake") return new FakeMpesaProvider();
  if (env.MPESA_ENV === "disabled") return new DisabledMpesaProvider();
  return new DarajaMpesaProvider({
    environment: env.MPESA_ENV,
    consumerKey: env.MPESA_CONSUMER_KEY!,
    consumerSecret: env.MPESA_CONSUMER_SECRET!,
    shortcode: env.MPESA_SHORTCODE,
    passkey: env.MPESA_PASSKEY!,
    callbackUrl: `${env.MPESA_CALLBACK_URL!.replace(/\/$/, "")}/api/v1/billing/mpesa/callback/${env.MPESA_CALLBACK_TOKEN!}`,
  });
}

@Module({
  controllers: [BillingController, MpesaCallbackController],
  providers: [
    AllowanceService,
    BillingService,
    BillingJobs,
    { provide: MPESA_PROVIDER, inject: [ENV], useFactory: createMpesaProvider },
  ],
  exports: [AllowanceService],
})
export class BillingModule {}
