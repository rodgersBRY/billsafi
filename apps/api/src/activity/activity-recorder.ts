import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  EventProps,
  FailedSignInMethod,
  FailedSignInReason,
  JobName,
  OperationFailureKind,
  ProductEventName,
} from "@billsafi/contracts";
import { type DatabaseConnection, schema } from "@billsafi/db";
import { nairobiDate } from "@billsafi/domain";
import { maskIpAddress } from "../admin/users/session-display.js";
import { DATABASE } from "../database/database.module.js";
import { errorClassOf, errorMessageOf } from "./sanitize.js";

export interface EventContext {
  accountId?: string | null;
  anonymousId?: string | null;
  invoiceId?: string | null;
  /** A repeat with the same key is dropped by the database. */
  dedupeKey?: string;
}

/**
 * Writes the facts the admin reads (D066). Every method is fire and forget: it returns at
 * once, never throws into the caller, and logs and drops a write that fails. A recording
 * problem must never break a PDF, an email or a sign-in.
 */
@Injectable()
export class ActivityRecorder {
  private readonly logger = new Logger(ActivityRecorder.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  /** Waits for writes started so far; for shutdown and tests, not for request paths. */
  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  private fire(label: string, write: () => Promise<unknown>): void {
    let started: Promise<unknown>;
    try {
      started = Promise.resolve(write());
    } catch (error) {
      started = Promise.reject(error);
    }
    const tracked: Promise<void> = started
      .then(
        () => undefined,
        (error: unknown) => {
          this.logger.warn(`Dropped ${label}: ${errorClassOf(error)}`);
        },
      )
      .finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }

  productEvent<N extends ProductEventName>(
    name: N,
    props: EventProps<N>,
    context: EventContext = {},
  ): void {
    this.fire(`event ${name}`, () =>
      this.connection.db
        .insert(schema.productEvents)
        .values({
          name,
          props,
          accountId: context.accountId ?? null,
          anonymousId: context.anonymousId ?? null,
          invoiceId: context.invoiceId ?? null,
          dedupeKey: context.dedupeKey ?? null,
        })
        .onConflictDoNothing(),
    );
  }

  pdfDownloaded(source: "app" | "public_link", accountId: string, invoiceId: string): void {
    this.productEvent("pdf_downloaded", { source }, { accountId, invoiceId });
  }

  /** One row per link per Nairobi day; the unique dedupe key drops the rest. */
  linkOpened(link: { id: string; accountId: string; invoiceId: string }, now = new Date()): void {
    this.productEvent(
      "link_opened",
      {},
      {
        accountId: link.accountId,
        invoiceId: link.invoiceId,
        dedupeKey: `link_opened:${link.id}:${nairobiDate(now)}`,
      },
    );
  }

  failure(
    kind: OperationFailureKind,
    operation: string,
    error: unknown,
    accountId: string | null = null,
  ): void {
    this.fire(`failure ${operation}`, () =>
      this.connection.db.insert(schema.operationFailures).values({
        kind,
        operation,
        accountId,
        errorClass: errorClassOf(error),
        message: errorMessageOf(error),
      }),
    );
  }

  /**
   * Runs one job step and records it as a job_runs row. A failure also adds an
   * operation_failures row and is rethrown for the caller to handle as before.
   */
  async trackJob(job: JobName, run: () => Promise<string | void>): Promise<void> {
    const startedAt = new Date();
    try {
      const detail = await run();
      this.jobRun({ job, startedAt, status: "succeeded", detail: detail || null });
    } catch (error) {
      this.jobRun({
        job,
        startedAt,
        status: "failed",
        detail: null,
        errorClass: errorClassOf(error),
      });
      this.failure("job", job, error);
      throw error;
    }
  }

  jobRun(run: {
    job: JobName;
    startedAt: Date;
    finishedAt?: Date;
    status: "succeeded" | "failed";
    detail: string | null;
    errorClass?: string;
  }): void {
    this.fire(`job run ${run.job}`, () =>
      this.connection.db.insert(schema.jobRuns).values({
        job: run.job,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt ?? new Date(),
        status: run.status,
        detail: run.detail,
        errorClass: run.errorClass ?? null,
      }),
    );
  }

  /** Never stores a password. The IP is masked to its network part, as on sessions. */
  failedSignIn(input: {
    email: string | null | undefined;
    method: FailedSignInMethod;
    reason: FailedSignInReason;
    ip?: string | null;
  }): void {
    const email = input.email?.trim().toLowerCase().slice(0, 320) || null;
    this.fire("failed sign-in", () =>
      this.connection.db.insert(schema.failedSignIns).values({
        email,
        method: input.method,
        reason: input.reason,
        ipMasked: maskIpAddress(input.ip),
      }),
    );
  }
}
