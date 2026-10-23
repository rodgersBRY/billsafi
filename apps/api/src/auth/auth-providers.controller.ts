import { Controller, Get, Inject } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { enabledSocialProviders } from "./auth.js";

/** Tells the sign-in and sign-up pages which extra sign-in buttons to show (D055). */
@AllowAnonymous()
@Controller("auth-providers")
export class AuthProvidersController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  list() {
    return enabledSocialProviders(this.env);
  }
}
