import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";

describe("GET /api/v1/health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { WEB_ORIGIN: "http://localhost:3000" });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports ok under the versioned prefix", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").expect(200, { status: "ok" });
  });

  it("does not serve unversioned routes", async () => {
    await request(app.getHttpServer()).get("/api/health").expect(404);
  });
});
