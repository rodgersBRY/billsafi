import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { createSavedItemSchema, updateSavedItemSchema } from "@billsafi/contracts";
import {
  and,
  asc,
  type DatabaseConnection,
  desc,
  eq,
  inArray,
  isNull,
  schema,
  sql,
} from "@billsafi/db";
import { canAddSavedItem, FREE_PLAN, newlyUsedSavedItems, proPeriodAt } from "@billsafi/domain";
import type { z } from "zod";
import { AllowanceService } from "../billing/allowance.service.js";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";
import type { Transaction } from "../database/transaction.js";

const { savedItems, businesses } = schema;

const UNIQUE_VIOLATION = "23505";
const ACTIVE_UNIQUE = "saved_items_business_description_active_unique";

export type SavedItemListFilter = { status: "active" | "archived"; search?: string };

function isDuplicate(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint?: string };
  return pg?.code === UNIQUE_VIOLATION && pg.constraint === ACTIVE_UNIQUE;
}

const duplicate = () =>
  new BadRequestException({
    message: "Validation failed",
    issues: [{ path: "description", message: "You already saved an item with this description" }],
  });

@Injectable()
export class SavedItemsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly allowance: AllowanceService,
  ) {}

  private get db() {
    return this.connection.db;
  }

  /** Most used first, so the dropdown leads with what the business bills most. */
  list(businessId: string, filter: SavedItemListFilter) {
    const conditions = [
      eq(savedItems.businessId, businessId),
      filter.status === "active"
        ? isNull(savedItems.archivedAt)
        : sql`${savedItems.archivedAt} is not null`,
    ];
    if (filter.search) {
      conditions.push(sql`${savedItems.description} ilike ${containsPattern(filter.search)}`);
    }

    return this.db
      .select()
      .from(savedItems)
      .where(and(...conditions))
      .orderBy(
        desc(savedItems.useCount),
        sql`${savedItems.lastUsedAt} desc nulls last`,
        asc(sql`lower(${savedItems.description})`),
      );
  }

  /** Free accounts are capped across all their businesses, under the account lock (D080). */
  async create(businessId: string, input: z.output<typeof createSavedItemSchema>) {
    try {
      return await this.db.transaction(async (tx) => {
        await this.checkLimit(tx, businessId);
        const [item] = await tx
          .insert(savedItems)
          .values({ ...input, businessId })
          .returning();

        return item!;
      });
    } catch (error) {
      if (isDuplicate(error)) throw duplicate();
      throw error;
    }
  }

  async update(businessId: string, itemId: string, input: z.output<typeof updateSavedItemSchema>) {
    try {
      const [item] = await this.db
        .update(savedItems)
        .set(input)
        .where(and(eq(savedItems.id, itemId), eq(savedItems.businessId, businessId)))
        .returning();
      if (!item) throw new NotFoundException("Saved item not found");

      return item;
    } catch (error) {
      if (isDuplicate(error)) throw duplicate();
      throw error;
    }
  }

  /** Hides the item from the dropdown and frees a Free-plan slot. Documents keep their copy. */
  async archive(businessId: string, itemId: string) {
    const [item] = await this.db
      .update(savedItems)
      .set({ archivedAt: sql`coalesce(${savedItems.archivedAt}, now())` })
      .where(and(eq(savedItems.id, itemId), eq(savedItems.businessId, businessId)))
      .returning();
    if (!item) throw new NotFoundException("Saved item not found");

    return item;
  }

  /**
   * Keeps only links to this business's own saved items, so a forged id is dropped
   * rather than stored. Returns the ids in the same order, with null for dropped ones.
   */
  async ownedLinks(
    tx: Transaction,
    businessId: string,
    ids: (string | null | undefined)[],
  ): Promise<(string | null)[]> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (wanted.length === 0) return ids.map(() => null);

    const owned = await tx
      .select({ id: savedItems.id })
      .from(savedItems)
      .where(and(eq(savedItems.businessId, businessId), inArray(savedItems.id, wanted)));
    const ownedIds = new Set(owned.map((row) => row.id));

    return ids.map((id) => (id && ownedIds.has(id) ? id : null));
  }

  /** Counts a use for each saved item newly placed on a document. */
  async recordUse(tx: Transaction, before: (string | null)[], after: (string | null)[]) {
    const used = newlyUsedSavedItems(before, after);
    if (used.length === 0) return;
    await tx
      .update(savedItems)
      .set({ useCount: sql`${savedItems.useCount} + 1`, lastUsedAt: sql`now()` })
      .where(inArray(savedItems.id, used));
  }

  private async checkLimit(tx: Transaction, businessId: string) {
    const [business] = await tx
      .select({ ownerUserId: businesses.ownerUserId })
      .from(businesses)
      .where(eq(businesses.id, businessId));
    const userId = business!.ownerUserId;
    const subscription = await this.allowance.lockAccount(tx, userId);
    const isPro = Boolean(
      subscription.anchorAt &&
      proPeriodAt(subscription.anchorAt, subscription.paidMonths, new Date()),
    );
    if (isPro) return;
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(savedItems)
      .innerJoin(businesses, eq(businesses.id, savedItems.businessId))
      .where(and(eq(businesses.ownerUserId, userId), isNull(savedItems.archivedAt)));
    if (!canAddSavedItem(false, row!.count)) {
      throw new ConflictException({
        code: "SAVED_ITEM_LIMIT",
        message: `The Free plan keeps ${FREE_PLAN.savedItemLimit} saved items. Archive one or upgrade to Pro to add more.`,
      });
    }
  }
}
