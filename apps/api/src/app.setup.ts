import { type INestApplication, VersioningType } from "@nestjs/common";
import { raw } from "express";
import type { Env } from "./config/env.js";

/** Shared by main.ts and e2e tests so both serve the same /api/v1 routes. */
export function configureApp(app: INestApplication, env: Pick<Env, "WEB_ORIGIN">): void {
  app.setGlobalPrefix("api");
  // Logo uploads arrive as raw image bytes; the service checks size and type (D052).
  app.use(
    "/api/v1/businesses/:businessId/logo",
    raw({ type: ["image/png", "image/jpeg"], limit: "1mb" }),
  );
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();
}
