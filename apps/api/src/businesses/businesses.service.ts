import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateBusiness,
  createPaymentInstructionSchema,
  updateBusinessSchema,
} from "@tallynest/contracts";
import { and, asc, type DatabaseConnection, eq, schema } from "@tallynest/db";
import type { z } from "zod";
import { DATABASE } from "../database/database.module.js";

const { businesses, businessPaymentInstructions } = schema;

@Injectable()
export class BusinessesService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  listOwned(ownerUserId: string) {
    return this.db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, ownerUserId))
      .orderBy(asc(businesses.createdAt));
  }

  async create(ownerUserId: string, input: CreateBusiness) {
    const [business] = await this.db
      .insert(businesses)
      .values({ ...input, ownerUserId })
      .returning();
    return business!;
  }

  /**
   * Every business operation goes through this check. Businesses owned by
   * another account are reported as missing so their existence never leaks.
   */
  async findOwned(ownerUserId: string, businessId: string) {
    const [business] = await this.db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)));
    if (!business) throw new NotFoundException("Business not found");
    return business;
  }

  async update(
    ownerUserId: string,
    businessId: string,
    input: z.output<typeof updateBusinessSchema>,
  ) {
    const [business] = await this.db
      .update(businesses)
      .set(input)
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
      .returning();
    if (!business) throw new NotFoundException("Business not found");
    return business;
  }

  listPaymentInstructions(businessId: string) {
    return this.db
      .select()
      .from(businessPaymentInstructions)
      .where(eq(businessPaymentInstructions.businessId, businessId))
      .orderBy(asc(businessPaymentInstructions.createdAt));
  }

  async createPaymentInstruction(
    businessId: string,
    input: z.output<typeof createPaymentInstructionSchema>,
  ) {
    const [instruction] = await this.db
      .insert(businessPaymentInstructions)
      .values({ ...input, businessId })
      .returning();
    return instruction!;
  }
}
