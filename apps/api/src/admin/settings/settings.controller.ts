import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AdminActionAck,
  type AdminSetting,
  type AdminSettings,
  type AdminSettingUpdate,
  adminSettingUpdateSchema,
  type PlatformSettingKey,
  platformSettingKeys,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { type AdminActionRequest, actionContext } from "../shared/action-request.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminActionRateLimitGuard } from "../shared/rate-limit.guard.js";
import { AdminSettingsService } from "./admin-settings.service.js";

function settingKey(value: string): PlatformSettingKey {
  const key = platformSettingKeys.find((candidate) => candidate === value);
  if (!key) throw new NotFoundException("Setting not found");
  return key;
}

// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin/settings")
export class SettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  list(): Promise<AdminSettings> {
    return this.settings.list();
  }

  /** Replaces one setting. Needs a reason, is audited with before and after, 10 a minute. */
  @Put(":key")
  @UseGuards(AdminActionRateLimitGuard)
  update(
    @Param("key") rawKey: string,
    @Body() rawBody: unknown,
    @Req() request: AdminActionRequest,
  ): Promise<AdminSetting | AdminActionAck> {
    const key = settingKey(rawKey);
    // The body's shape depends on the key, so validate here rather than in a fixed pipe.
    const body = new ZodValidationPipe(adminSettingUpdateSchema(key)).transform(
      rawBody,
    ) as AdminSettingUpdate;
    return this.settings.update(actionContext(request, body), key, body);
  }
}
