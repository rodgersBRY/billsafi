import { Body, Controller, HttpCode, Post, Query } from "@nestjs/common";
import { unsubscribeRequestSchema } from "@billsafi/contracts";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ReengagementService } from "./reengagement.service.js";

/**
 * Unsubscribe from check-in emails without signing in (D069). The web page posts the token
 * in the body. Mail apps use one-click unsubscribe (RFC 8058), which posts to the
 * List-Unsubscribe URL with the token in the query string.
 */
@AllowAnonymous()
@Controller("email-preferences")
export class EmailPreferencesController {
  constructor(private readonly reengagement: ReengagementService) {}

  @Post("unsubscribe")
  @HttpCode(204)
  async unsubscribe(
    @Query("token") queryToken: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    const bodyToken =
      body && typeof body === "object" && "token" in body
        ? (body as { token: unknown }).token
        : undefined;
    const { token } = new ZodValidationPipe(unsubscribeRequestSchema).transform({
      token: queryToken ?? bodyToken,
    });
    await this.reengagement.unsubscribe(token);
  }
}
