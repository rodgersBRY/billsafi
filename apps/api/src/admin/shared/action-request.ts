import { BadRequestException } from "@nestjs/common";
import { type AdminActionBody, idempotencyKeySchema } from "@billsafi/contracts";
import type { Request } from "express";
import type { AuthenticatedRequest } from "../../common/current-user.js";
import type { RequestWithId } from "../../common/request-id.js";
import type { AdminActionContext } from "./admin-action-runner.js";

export type AdminActionRequest = Request & Partial<RequestWithId> & AuthenticatedRequest;

/** The optional Idempotency-Key header; 400 when it is sent but blank or too long. */
export function idempotencyKey(header: string | string[] | undefined): string | undefined {
  if (header === undefined) return undefined;
  const parsed = idempotencyKeySchema.safeParse(Array.isArray(header) ? header.join(",") : header);
  if (!parsed.success) {
    throw new BadRequestException({
      message: "Validation failed",
      issues: [{ path: "Idempotency-Key", message: parsed.error.issues[0]!.message }],
    });
  }
  return parsed.data;
}

export function actionContext(
  request: AdminActionRequest,
  body: AdminActionBody,
): AdminActionContext {
  return {
    // AdminGuard has already required a signed-in admin.
    adminId: request.user.id,
    reason: body.reason,
    request: { requestId: request.requestId, ip: request.ip },
  };
}
