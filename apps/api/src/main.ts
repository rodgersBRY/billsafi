import "reflect-metadata";
import { existsSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { loadEnv } from "./config/env.js";

const rootEnvFile = new URL("../../../.env", import.meta.url);
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, env);

  await app.listen(env.API_PORT);
  console.log(`API running on ${await app.getUrl()}/api/v1`);
}
await bootstrap();
