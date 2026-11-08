import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminActionAck,
  AdminWhatsNewEntry,
  AdminWhatsNewList,
  WhatsNewEntryInput,
} from "@billsafi/contracts";
import { type DatabaseConnection, desc, eq, schema } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import type { Transaction } from "../../database/transaction.js";
import { toAdminWhatsNewEntry } from "../../whats-new/whats-new.mapper.js";
import {
  type AdminActionContext,
  AdminActionRunner,
  UnauditedRefusal,
} from "../shared/admin-action-runner.js";

const { whatsNewEntries } = schema;

/** The columns an admin can set, from the validated input. */
function columns(input: WhatsNewEntryInput) {
  return {
    title: input.title,
    body: input.body,
    linkSegment: input.linkSegment ?? null,
    pro: input.pro,
    popup: input.popup,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
  };
}

type Columns = ReturnType<typeof columns>;

/** Fields that differ, as { from, to }, for the audit log. */
function diff(before: Record<keyof Columns, unknown>, after: Columns) {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const plain = (value: unknown) => (value instanceof Date ? value.toISOString() : value);
  for (const key of Object.keys(after) as (keyof Columns)[]) {
    const from = plain(before[key]);
    const to = plain(after[key]);
    if (from !== to) changed[key] = { from, to };
  }
  return changed;
}

/** Admin editing of What's new entries. Every write is audited. */
@Injectable()
export class AdminWhatsNewService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly runner: AdminActionRunner,
  ) {}

  async list(now = new Date()): Promise<AdminWhatsNewList> {
    const rows = await this.connection.db
      .select()
      .from(whatsNewEntries)
      .orderBy(desc(whatsNewEntries.createdAt));
    return {
      entries: rows.map((row) => toAdminWhatsNewEntry(row, now)),
      generatedAt: now.toISOString(),
    };
  }

  async get(id: string, now = new Date()): Promise<AdminWhatsNewEntry> {
    const [row] = await this.connection.db
      .select()
      .from(whatsNewEntries)
      .where(eq(whatsNewEntries.id, id));
    if (!row) throw new NotFoundException("Entry not found");
    return toAdminWhatsNewEntry(row, now);
  }

  private async lock(tx: Transaction, id: string) {
    const [row] = await tx
      .select()
      .from(whatsNewEntries)
      .where(eq(whatsNewEntries.id, id))
      .for("update");
    if (!row) throw new NotFoundException("Entry not found");
    return row;
  }

  async create(
    context: AdminActionContext,
    input: WhatsNewEntryInput,
  ): Promise<AdminWhatsNewEntry | AdminActionAck> {
    const id = randomUUID();
    const values = columns(input);
    await this.runner.perform(
      context,
      { action: "whats_new.create", target: { type: "whats_new_entry", id } },
      async (tx) => {
        await tx.insert(whatsNewEntries).values({ id, ...values, createdBy: context.adminId });
        return { title: values.title, published: values.publishedAt !== null };
      },
    );
    return this.runner.summaryAfter(context.adminId, () => this.get(id));
  }

  async update(
    context: AdminActionContext,
    id: string,
    input: WhatsNewEntryInput,
  ): Promise<AdminWhatsNewEntry | AdminActionAck> {
    const values = columns(input);
    await this.runner.perform(
      context,
      { action: "whats_new.update", target: { type: "whats_new_entry", id } },
      async (tx) => {
        const row = await this.lock(tx, id);
        const changed = diff(
          {
            title: row.title,
            body: row.body,
            linkSegment: row.linkSegment,
            pro: row.pro,
            popup: row.popup,
            publishedAt: row.publishedAt,
          },
          values,
        );
        if (Object.keys(changed).length === 0) {
          throw new UnauditedRefusal({ code: "NO_CHANGE", message: "Nothing changed." });
        }
        await tx
          .update(whatsNewEntries)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(whatsNewEntries.id, id));
        return { title: values.title, changed };
      },
    );
    return this.runner.summaryAfter(context.adminId, () => this.get(id));
  }

  async remove(context: AdminActionContext, id: string): Promise<AdminActionAck> {
    await this.runner.perform(
      context,
      { action: "whats_new.delete", target: { type: "whats_new_entry", id } },
      async (tx) => {
        const row = await this.lock(tx, id);
        await tx.delete(whatsNewEntries).where(eq(whatsNewEntries.id, id));
        return { title: row.title, publishedAt: row.publishedAt?.toISOString() ?? null };
      },
    );
    return { ok: true };
  }
}
