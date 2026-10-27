import { type INestApplication, VersioningType } from "@nestjs/common";
import { raw } from "express";
import { REQUEST_ID_HEADER, requestId } from "./common/request-id.js";
import type { Env } from "./config/env.js";

/** Shared by main.ts and e2e tests so both serve the same /api/v1 routes. */
export function configureApp(app: INestApplication, env: Pick<Env, "WEB_ORIGIN">): void {
  app.setGlobalPrefix("api");
  // In production the chain is Caddy -> Next rewrite -> API on the Docker network. Trusting
  // only private and loopback hops makes req.ip the client from X-Forwarded-For (set by
  // Caddy) instead of the web container, while a forged header from a public address is
  // ignored.
  app.getHttpAdapter().getInstance().set("trust proxy", "loopback, linklocal, uniquelocal");
  // First, so auth routes and errors carry an ID too.
  app.use(requestId);
  // Logo uploads arrive as raw image bytes; the service checks size and type (D052).
  app.use(
    "/api/v1/businesses/:businessId/logo",
    raw({ type: ["image/png", "image/jpeg"], limit: "1mb" }),
  );
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.enableShutdownHooks();
}
