import { timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import {
  type BillingOverview,
  type Checkout,
  checkoutSchema,
  type SubscriptionPayment,
} from "@billsafi/contracts";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import { CurrentUserId } from "../common/current-user.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { BillingService, type PaymentOutcome } from "./billing.service.js";

/** Account billing: one subscription covers every business (D018). */
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  overview(@CurrentUserId() userId: string): Promise<BillingOverview> {
    return this.billing.overview(userId);
  }

  @Post("checkout")
  checkout(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(checkoutSchema)) body: Checkout,
  ): Promise<SubscriptionPayment> {
    return this.billing.checkout(userId, body);
  }

  @Get("payments/:paymentId")
  payment(
    @CurrentUserId() userId: string,
    @Param("paymentId", new UuidParamPipe("Payment")) paymentId: string,
  ): Promise<SubscriptionPayment> {
    return this.billing.payment(userId, paymentId);
  }

  @Post("cancel")
  @HttpCode(200)
  cancel(@CurrentUserId() userId: string): Promise<BillingOverview> {
    return this.billing.cancel(userId);
  }

  @Post("resume")
  @HttpCode(200)
  resume(@CurrentUserId() userId: string): Promise<BillingOverview> {
    return this.billing.resume(userId);
  }
}

const callbackItem = z.object({
  Name: z.string(),
  Value: z.union([z.string(), z.number()]).optional(),
});
const callbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      CheckoutRequestID: z.string(),
      ResultCode: z.coerce.number(),
      ResultDesc: z.string().default(""),
      CallbackMetadata: z.object({ Item: z.array(callbackItem) }).optional(),
    }),
  }),
});

/**
 * Daraja posts STK results here (D051). Daraja does not sign callbacks, so the
 * URL carries a secret token, and the request id must match one we created.
 */
@AllowAnonymous()
@Controller("billing/mpesa")
export class MpesaCallbackController {
  private readonly logger = new Logger(MpesaCallbackController.name);

  constructor(
    private readonly billing: BillingService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post("callback/:token")
  @HttpCode(200)
  async callback(@Param("token") token: string, @Body() body: unknown) {
    if (!this.tokenMatches(token)) throw new NotFoundException();
    const parsed = callbackSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn("Ignored a malformed M-Pesa callback");
      return { ResultCode: 0, ResultDesc: "Accepted" };
    }
    const result = parsed.data.Body.stkCallback;
    const value = (name: string) =>
      result.CallbackMetadata?.Item.find((item) => item.Name === name)?.Value;
    const outcome: PaymentOutcome =
      result.ResultCode === 0
        ? {
            state: "succeeded",
            receipt: value("MpesaReceiptNumber")?.toString(),
            amount: value("Amount") === undefined ? undefined : Number(value("Amount")),
          }
        : {
            state: "failed",
            resultCode: String(result.ResultCode),
            resultDescription: result.ResultDesc || "Payment was not completed",
          };
    await this.billing.confirm(result.CheckoutRequestID, outcome);
    return { ResultCode: 0, ResultDesc: "Accepted" };
  }

  private tokenMatches(token: string): boolean {
    const expected = this.env.MPESA_CALLBACK_TOKEN ?? (this.env.MPESA_ENV === "fake" ? "fake" : "");
    if (!expected) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
