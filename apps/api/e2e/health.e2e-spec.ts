import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./support/app.js";

describe("GET /api/v1/health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports the API and database as healthy without a session", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200, { status: "ok", database: "ok" });
  });

  it("does not serve unversioned routes", async () => {
    await request(app.getHttpServer()).get("/api/health").expect(404);
  });
});
