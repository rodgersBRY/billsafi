import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { createSavedItemSchema, type SavedItem, updateSavedItemSchema } from "@billsafi/contracts";
import { z } from "zod";
import { BusinessOwnerGuard } from "../businesses/business-owner.guard.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { toSavedItem } from "./saved-item.mapper.js";
import { type SavedItemListFilter, SavedItemsService } from "./saved-items.service.js";

const listQuerySchema = z.object({
  status: z.enum(["active", "archived"]).default("active"),
  search: z.string().trim().max(100).optional(),
});

@Controller("businesses/:businessId/items")
@UseGuards(BusinessOwnerGuard)
export class SavedItemsController {
  constructor(private readonly items: SavedItemsService) {}

  @Get()
  async list(
    @Param("businessId") businessId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: SavedItemListFilter,
  ): Promise<SavedItem[]> {
    return (await this.items.list(businessId, query)).map(toSavedItem);
  }

  @Post()
  async create(
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(createSavedItemSchema))
    input: z.output<typeof createSavedItemSchema>,
  ): Promise<SavedItem> {
    return toSavedItem(await this.items.create(businessId, input));
  }

  @Patch(":itemId")
  async update(
    @Param("businessId") businessId: string,
    @Param("itemId", new UuidParamPipe("Saved item")) itemId: string,
    @Body(new ZodValidationPipe(updateSavedItemSchema))
    input: z.output<typeof updateSavedItemSchema>,
  ): Promise<SavedItem> {
    return toSavedItem(await this.items.update(businessId, itemId, input));
  }

  @Post(":itemId/archive")
  @HttpCode(200)
  async archive(
    @Param("businessId") businessId: string,
    @Param("itemId", new UuidParamPipe("Saved item")) itemId: string,
  ): Promise<SavedItem> {
    return toSavedItem(await this.items.archive(businessId, itemId));
  }
}
