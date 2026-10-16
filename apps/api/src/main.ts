import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { loadRootEnvFile } from "./config/env-file.js";
import { loadEnv } from "./config/env.js";

loadRootEnvFile();

async function bootstrap() {
  const env = loadEnv();
  // Better Auth reads raw request bodies; the auth module re-adds parsers for other routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  configureApp(app, env);

  await app.listen(env.API_PORT);
  console.log(`API has nested and is ready to tally at ${await app.getUrl()}/api/v1`);
}

await bootstrap();
