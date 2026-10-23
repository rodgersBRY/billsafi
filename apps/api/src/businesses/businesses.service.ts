import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateBusiness,
  createPaymentInstructionSchema,
  updateBusinessSchema,
} from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, eq, schema } from "@billsafi/db";
import type { z } from "zod";
import { DATABASE } from "../database/database.module.js";
import type { Executor } from "../database/transaction.js";

const { businesses, businessPaymentInstructions, businessLogos } = schema;

export const LOGO_MAX_BYTES = 512 * 1024;

/** Detects PNG and JPEG from their first bytes rather than trusting the header. */
export function logoContentType(data: Buffer): "image/png" | "image/jpeg" | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  return null;
}

@Injectable()
export class BusinessesService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  listOwned(ownerUserId: string, db: Executor = this.db) {
    return db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, ownerUserId))
      .orderBy(asc(businesses.createdAt));
  }

  async create(ownerUserId: string, input: CreateBusiness, db: Executor = this.db) {
    const [business] = await db
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

  /** Stores a new logo and points the business at it (D052). */
  async uploadLogo(ownerUserId: string, businessId: string, data: unknown) {
    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new BadRequestException({
        code: "LOGO_INVALID",
        message: "Choose a PNG or JPEG image",
      });
    }
    if (data.length > LOGO_MAX_BYTES) {
      throw new BadRequestException({
        code: "LOGO_TOO_LARGE",
        message: "The logo must be 512 KB or smaller",
      });
    }
    const contentType = logoContentType(data);
    if (!contentType) {
      throw new BadRequestException({
        code: "LOGO_INVALID",
        message: "Choose a PNG or JPEG image",
      });
    }
    return this.db.transaction(async (tx) => {
      const [logo] = await tx
        .insert(businessLogos)
        .values({ businessId, contentType, data })
        .returning({ id: businessLogos.id });
      const [business] = await tx
        .update(businesses)
        .set({ logoKey: logo!.id })
        .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
        .returning();
      if (!business) throw new NotFoundException("Business not found");
      return business;
    });
  }

  /** Removes the logo from new invoices; issued invoices keep theirs. */
  async removeLogo(ownerUserId: string, businessId: string) {
    const [business] = await this.db
      .update(businesses)
      .set({ logoKey: null })
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
      .returning();
    if (!business) throw new NotFoundException("Business not found");
    return business;
  }

  async findLogo(businessId: string, logoId: string) {
    const [logo] = await this.db
      .select({ contentType: businessLogos.contentType, data: businessLogos.data })
      .from(businessLogos)
      .where(and(eq(businessLogos.id, logoId), eq(businessLogos.businessId, businessId)));
    if (!logo) throw new NotFoundException("Logo not found");
    return logo;
  }
}
