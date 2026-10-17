import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Req,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import {
  type Business,
  type CreateBusiness,
  createBusinessSchema,
  createPaymentInstructionSchema,
  type PaymentInstruction,
  updateBusinessSchema,
} from "@billsafi/contracts";
import type { z } from "zod";
import { CurrentUserId } from "../common/current-user.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { toBusiness, toPaymentInstruction } from "./business.mapper.js";
import { BusinessOwnerGuard } from "./business-owner.guard.js";
import { BusinessesService } from "./businesses.service.js";

@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  async list(@CurrentUserId() userId: string): Promise<Business[]> {
    return (await this.businesses.listOwned(userId)).map(toBusiness);
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createBusinessSchema)) input: CreateBusiness,
  ): Promise<Business> {
    return toBusiness(await this.businesses.create(userId, input));
  }

  @Get(":businessId")
  @UseGuards(BusinessOwnerGuard)
  async get(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
  ): Promise<Business> {
    return toBusiness(await this.businesses.findOwned(userId, businessId));
  }

  @Patch(":businessId")
  @UseGuards(BusinessOwnerGuard)
  async update(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(updateBusinessSchema)) input: z.output<typeof updateBusinessSchema>,
  ): Promise<Business> {
    return toBusiness(await this.businesses.update(userId, businessId, input));
  }

  @Get(":businessId/payment-instructions")
  @UseGuards(BusinessOwnerGuard)
  async listPaymentInstructions(
    @Param("businessId") businessId: string,
  ): Promise<PaymentInstruction[]> {
    return (await this.businesses.listPaymentInstructions(businessId)).map(toPaymentInstruction);
  }

  @Post(":businessId/payment-instructions")
  @UseGuards(BusinessOwnerGuard)
  async createPaymentInstruction(
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(createPaymentInstructionSchema))
    input: z.output<typeof createPaymentInstructionSchema>,
  ): Promise<PaymentInstruction> {
    return toPaymentInstruction(await this.businesses.createPaymentInstruction(businessId, input));
  }

  /** Raw PNG or JPEG body, parsed by the raw-body middleware in app.setup.ts (D052). */
  @Put(":businessId/logo")
  @UseGuards(BusinessOwnerGuard)
  async uploadLogo(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
    @Req() request: { body: unknown },
  ): Promise<Business> {
    return toBusiness(await this.businesses.uploadLogo(userId, businessId, request.body));
  }

  @Delete(":businessId/logo")
  @UseGuards(BusinessOwnerGuard)
  async removeLogo(
    @CurrentUserId() userId: string,
    @Param("businessId") businessId: string,
  ): Promise<Business> {
    return toBusiness(await this.businesses.removeLogo(userId, businessId));
  }

  /** Logo rows never change, so browsers may cache them for good. */
  @Get(":businessId/logos/:logoId")
  @UseGuards(BusinessOwnerGuard)
  @Header("Cache-Control", "private, max-age=31536000, immutable")
  async logo(
    @Param("businessId") businessId: string,
    @Param("logoId", new UuidParamPipe("Logo")) logoId: string,
  ): Promise<StreamableFile> {
    const logo = await this.businesses.findLogo(businessId, logoId);
    return new StreamableFile(logo.data, { type: logo.contentType });
  }
}
