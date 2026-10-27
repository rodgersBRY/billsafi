import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminSupportCaseCreate,
  AdminSupportCaseResult,
  AdminSupportCaseUpdate,
  AdminSupportNote,
  AdminSupportNoteResult,
  AdminSupportResolve,
} from "@billsafi/contracts";
import { eq, schema, sql } from "@billsafi/db";
import type { Transaction } from "../../database/transaction.js";
import {
  type AdminActionContext,
  AdminActionRunner,
  conflict,
} from "../shared/admin-action-runner.js";
import { AdminSupportService } from "./admin-support.service.js";

const { supportCases, supportNotes, users } = schema;
const DEFAULT_NOTE_REASON = "Internal note";

function invalid(path: string, message: string): BadRequestException {
  return new BadRequestException({ message: "Validation failed", issues: [{ path, message }] });
}

/** Write side of Support. Note text is stored in the note, never copied to the audit log. */
@Injectable()
export class SupportActionsService {
  constructor(
    private readonly runner: AdminActionRunner,
    private readonly reads: AdminSupportService,
  ) {}

  /** Locks the case row; 404 when unknown. */
  private async lockCase(tx: Transaction, id: string) {
    const [row] = await tx
      .select()
      .from(supportCases)
      .where(eq(supportCases.id, id))
      .for("no key update");
    if (!row) throw new NotFoundException("Case not found");
    return row;
  }

  private async requireAdmin(tx: Transaction, id: string, path: string) {
    const [user] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id));
    if (user?.role !== "admin") throw invalid(path, "Choose an admin");
  }

  async create(
    context: AdminActionContext,
    body: AdminSupportCaseCreate,
  ): Promise<AdminSupportCaseResult> {
    const id = await this.runner.performWith(
      context,
      { action: "support.case_create", target: { type: "account", id: body.accountId } },
      async (tx) => {
        await this.runner.lockUser(tx, body.accountId);
        if (body.assignedTo) await this.requireAdmin(tx, body.assignedTo, "assignedTo");
        const [created] = await tx
          .insert(supportCases)
          .values({
            accountId: body.accountId,
            title: body.title,
            category: body.category,
            severity: body.severity,
            assignedTo: body.assignedTo ?? null,
            createdBy: context.adminId,
          })
          .returning({ id: supportCases.id });
        return {
          changes: {
            caseId: created!.id,
            title: body.title,
            category: body.category,
            severity: body.severity,
            assignedTo: body.assignedTo ?? null,
          },
          result: created!.id,
        };
      },
    );
    return this.runner.summaryAfter(context.adminId, () => this.reads.caseRow(id));
  }

  async update(
    context: AdminActionContext,
    id: string,
    body: AdminSupportCaseUpdate,
  ): Promise<AdminSupportCaseResult> {
    await this.runner.perform(
      context,
      { action: "support.case_update", target: { type: "support_case", id } },
      async (tx) => {
        const current = await this.lockCase(tx, id);
        if (current.status === "resolved") {
          throw conflict("CASE_RESOLVED", "Reopen this case before changing it.");
        }
        if (body.assignedTo) await this.requireAdmin(tx, body.assignedTo, "assignedTo");
        const next = {
          title: body.title ?? current.title,
          category: body.category ?? current.category,
          severity: body.severity ?? current.severity,
          status: body.status ?? current.status,
          assignedTo: body.assignedTo === undefined ? current.assignedTo : body.assignedTo,
        };
        const changes: Record<string, unknown> = {};
        for (const key of Object.keys(next) as (keyof typeof next)[]) {
          if (next[key] !== current[key]) changes[key] = { from: current[key], to: next[key] };
        }
        if (Object.keys(changes).length === 0) throw conflict("NO_CHANGE", "Nothing changed.");
        await tx
          .update(supportCases)
          .set({ ...next, updatedAt: new Date() })
          .where(eq(supportCases.id, id));
        return changes;
      },
    );
    return this.runner.summaryAfter(context.adminId, () => this.reads.caseRow(id));
  }

  async resolve(
    context: AdminActionContext,
    id: string,
    body: AdminSupportResolve,
  ): Promise<AdminSupportCaseResult> {
    await this.runner.perform(
      context,
      { action: "support.case_resolve", target: { type: "support_case", id } },
      async (tx) => {
        const current = await this.lockCase(tx, id);
        if (current.status === "resolved") {
          throw conflict("ALREADY_RESOLVED", "This case is already resolved.");
        }
        const now = new Date();
        await tx
          .update(supportCases)
          .set({
            status: "resolved",
            resolvedAt: now,
            resolution: body.resolution,
            updatedAt: now,
          })
          .where(eq(supportCases.id, id));
        // The resolution text stays on the case; the audit row keeps only its length.
        return {
          status: { from: current.status, to: "resolved" },
          resolutionLength: body.resolution.length,
        };
      },
    );
    return this.runner.summaryAfter(context.adminId, () => this.reads.caseRow(id));
  }

  /**
   * Reopening clears the resolution (the table requires it), so the old text is kept as an
   * automatic note: history is append-only.
   */
  async reopen(context: AdminActionContext, id: string): Promise<AdminSupportCaseResult> {
    await this.runner.perform(
      context,
      { action: "support.case_reopen", target: { type: "support_case", id } },
      async (tx) => {
        const current = await this.lockCase(tx, id);
        if (current.status !== "resolved") {
          throw conflict("NOT_RESOLVED", "This case is not resolved.");
        }
        await tx.insert(supportNotes).values({
          caseId: id,
          accountId: current.accountId,
          authorId: context.adminId,
          body: `Reopened. The earlier resolution was: ${current.resolution}`,
        });
        await tx
          .update(supportCases)
          .set({ status: "open", resolvedAt: null, resolution: null, updatedAt: new Date() })
          .where(eq(supportCases.id, id));
        return { status: { from: "resolved", to: "open" } };
      },
    );
    return this.runner.summaryAfter(context.adminId, () => this.reads.caseRow(id));
  }

  /** Adds a note to a case, or loose on an account when `caseId` is null. */
  async addNote(
    context: AdminActionContext,
    target: { caseId: string } | { accountId: string },
    text: string,
  ): Promise<AdminSupportNoteResult> {
    const caseId = "caseId" in target ? target.caseId : null;
    const auditTarget =
      "caseId" in target
        ? { type: "support_case" as const, id: target.caseId }
        : { type: "account" as const, id: target.accountId };
    const note = await this.runner.performWith<AdminSupportNote>(
      { ...context, reason: context.reason || DEFAULT_NOTE_REASON },
      { action: "support.note_add", target: auditTarget },
      async (tx) => {
        let accountId: string;
        if (caseId) {
          accountId = (await this.lockCase(tx, caseId)).accountId;
          await tx
            .update(supportCases)
            .set({ updatedAt: sql`now()` })
            .where(eq(supportCases.id, caseId));
        } else {
          accountId = (target as { accountId: string }).accountId;
          await this.runner.lockUser(tx, accountId);
        }
        const [row] = await tx
          .insert(supportNotes)
          .values({ caseId, accountId, authorId: context.adminId, body: text })
          .returning();
        const [author] = await tx
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, context.adminId));
        return {
          // Only the note's id and length, so private text does not spread.
          changes: { noteId: row!.id, length: text.length },
          result: {
            id: row!.id,
            caseId: row!.caseId,
            accountId: row!.accountId,
            author: author ?? null,
            body: row!.body,
            createdAt: row!.createdAt.toISOString(),
          },
        };
      },
    );
    return note;
  }
}
