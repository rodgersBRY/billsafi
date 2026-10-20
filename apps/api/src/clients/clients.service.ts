import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createClientSchema, updateClientSchema } from "@billsafi/contracts";
import { and, asc, type DatabaseConnection, eq, isNull, or, schema, sql } from "@billsafi/db";
import type { z } from "zod";
import { containsPattern } from "../common/like-pattern.js";
import { DATABASE } from "../database/database.module.js";

const { clients } = schema;

export type ClientListFilter = { status: "active" | "archived"; search?: string };

@Injectable()
export class ClientsService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  private get db() {
    return this.connection.db;
  }

  list(businessId: string, filter: ClientListFilter) {
    const conditions = [
      eq(clients.businessId, businessId),
      filter.status === "active"
        ? isNull(clients.archivedAt)
        : sql`${clients.archivedAt} is not null`,
    ];
    if (filter.search) {
      const pattern = containsPattern(filter.search);
      conditions.push(
        or(
          sql`${clients.name} ilike ${pattern}`,
          sql`${clients.companyName} ilike ${pattern}`,
          sql`${clients.email} ilike ${pattern}`,
          sql`${clients.phone} ilike ${pattern}`,
        )!,
      );
    }
    return this.db
      .select()
      .from(clients)
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${clients.name})`));
  }

  async create(businessId: string, input: z.output<typeof createClientSchema>) {
    const [client] = await this.db
      .insert(clients)
      .values({ ...input, businessId })
      .returning();
    return client!;
  }

  async find(businessId: string, clientId: string) {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)));
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }

  /** Edits the saved profile only; issued invoices keep their own copy (D010, D048). */
  async update(businessId: string, clientId: string, input: z.output<typeof updateClientSchema>) {
    const [client] = await this.db
      .update(clients)
      .set(input)
      .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)))
      .returning();
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }

  /** Hides the client from new invoice selections; existing invoices are untouched. */
  async archive(businessId: string, clientId: string) {
    const [client] = await this.db
      .update(clients)
      .set({ archivedAt: sql`coalesce(${clients.archivedAt}, now())` })
      .where(and(eq(clients.id, clientId), eq(clients.businessId, businessId)))
      .returning();
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }
}
