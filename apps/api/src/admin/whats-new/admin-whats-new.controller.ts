import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  type AdminActionAck,
  type AdminActionBody,
  adminActionBodySchema,
  type AdminWhatsNewEntry,
  type AdminWhatsNewList,
  type AdminWhatsNewSave,
  adminWhatsNewSaveSchema,
} from "@billsafi/contracts";
import { OptionalAuth } from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { type AdminActionRequest, actionContext } from "../shared/action-request.js";
import { AdminGuard } from "../shared/admin.guard.js";
import { AdminActionRateLimitGuard } from "../shared/rate-limit.guard.js";
import { AdminWhatsNewService } from "./admin-whats-new.service.js";

/** A malformed id is an unknown entry, not a bad request. */
function entryId(value: string): string {
  if (!z.uuid().safeParse(value).success) throw new NotFoundException("Entry not found");
  return value;
}

// OptionalAuth lets signed-out requests reach AdminGuard, so they get 404 not 401.
@OptionalAuth()
@UseGuards(AdminGuard)
@Controller("admin/whats-new")
export class AdminWhatsNewController {
  constructor(private readonly entries: AdminWhatsNewService) {}

  @Get()
  list(): Promise<AdminWhatsNewList> {
    return this.entries.list();
  }

  @Post()
  @UseGuards(AdminActionRateLimitGuard)
  create(
    @Body(new ZodValidationPipe(adminWhatsNewSaveSchema)) body: AdminWhatsNewSave,
    @Req() request: AdminActionRequest,
  ): Promise<AdminWhatsNewEntry | AdminActionAck> {
    return this.entries.create(actionContext(request, body), body);
  }

  /** Replaces the entry. No publishedAt turns it back into a draft. */
  @Put(":id")
  @UseGuards(AdminActionRateLimitGuard)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminWhatsNewSaveSchema)) body: AdminWhatsNewSave,
    @Req() request: AdminActionRequest,
  ): Promise<AdminWhatsNewEntry | AdminActionAck> {
    return this.entries.update(actionContext(request, body), entryId(id), body);
  }

  @Post(":id/delete")
  @UseGuards(AdminActionRateLimitGuard)
  remove(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminActionBodySchema)) body: AdminActionBody,
    @Req() request: AdminActionRequest,
  ): Promise<AdminActionAck> {
    return this.entries.remove(actionContext(request, body), entryId(id));
  }
}
