import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

export type RequestWithId = Request & { requestId: string };

/**
 * Tags every request with an ID, echoed in the response header, so an audit row can be
 * matched to proxy logs and Sentry. A caller's ID is kept only if it is short and plain,
 * so nobody can inject text into logs through it.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === "string" && SAFE_ID.test(incoming) ? incoming : randomUUID();
  (req as RequestWithId).requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
