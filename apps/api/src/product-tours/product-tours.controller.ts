import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import {
  type GettingStarted,
  type ProductTourKey,
  type ProductTourState,
  type SaveProductTour,
  productTourKeySchema,
  saveProductTourSchema,
} from "@billsafi/contracts";
import { CurrentUserId } from "../common/current-user.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ProductToursService } from "./product-tours.service.js";

@Controller("me")
export class ProductToursController {
  constructor(private readonly tours: ProductToursService) {}

  @Get("tours")
  list(@CurrentUserId() userId: string): Promise<ProductTourState[]> {
    return this.tours.list(userId);
  }

  @Put("tours/:key")
  save(
    @CurrentUserId() userId: string,
    @Param("key", new ZodValidationPipe(productTourKeySchema)) key: ProductTourKey,
    @Body(new ZodValidationPipe(saveProductTourSchema)) input: SaveProductTour,
  ): Promise<ProductTourState> {
    return this.tours.save(userId, key, input);
  }

  @Get("getting-started")
  gettingStarted(@CurrentUserId() userId: string): Promise<GettingStarted> {
    return this.tours.gettingStarted(userId);
  }
}
