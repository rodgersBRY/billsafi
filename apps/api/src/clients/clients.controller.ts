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
import { type Client, createClientSchema, updateClientSchema } from "@tallynest/contracts";
import { z } from "zod";
import { BusinessOwnerGuard } from "../businesses/business-owner.guard.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { toClient } from "./client.mapper.js";
import { type ClientListFilter, ClientsService } from "./clients.service.js";

const listQuerySchema = z.object({
  status: z.enum(["active", "archived"]).default("active"),
  search: z.string().trim().max(100).optional(),
});

@Controller("businesses/:businessId/clients")
@UseGuards(BusinessOwnerGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  async list(
    @Param("businessId") businessId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ClientListFilter,
  ): Promise<Client[]> {
    return (await this.clients.list(businessId, query)).map(toClient);
  }

  @Post()
  async create(
    @Param("businessId") businessId: string,
    @Body(new ZodValidationPipe(createClientSchema)) input: z.output<typeof createClientSchema>,
  ): Promise<Client> {
    return toClient(await this.clients.create(businessId, input));
  }

  @Get(":clientId")
  async get(
    @Param("businessId") businessId: string,
    @Param("clientId", new UuidParamPipe("Client")) clientId: string,
  ): Promise<Client> {
    return toClient(await this.clients.find(businessId, clientId));
  }

  @Patch(":clientId")
  async update(
    @Param("businessId") businessId: string,
    @Param("clientId", new UuidParamPipe("Client")) clientId: string,
    @Body(new ZodValidationPipe(updateClientSchema)) input: z.output<typeof updateClientSchema>,
  ): Promise<Client> {
    return toClient(await this.clients.update(businessId, clientId, input));
  }

  @Post(":clientId/archive")
  @HttpCode(200)
  async archive(
    @Param("businessId") businessId: string,
    @Param("clientId", new UuidParamPipe("Client")) clientId: string,
  ): Promise<Client> {
    return toClient(await this.clients.archive(businessId, clientId));
  }
}
