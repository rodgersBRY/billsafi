import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import type { WhatsNewFeed } from "@billsafi/contracts";
import { CurrentUserId } from "../common/current-user.js";
import { WhatsNewService } from "./whats-new.service.js";

@Controller("whats-new")
export class WhatsNewController {
  constructor(private readonly whatsNew: WhatsNewService) {}

  /** Not cached: unread and popup depend on the user. */
  @Get()
  feed(@CurrentUserId() userId: string): Promise<WhatsNewFeed> {
    return this.whatsNew.feed(userId);
  }

  @Post("seen")
  @HttpCode(204)
  async seen(@CurrentUserId() userId: string): Promise<void> {
    await this.whatsNew.markSeen(userId);
  }
}
