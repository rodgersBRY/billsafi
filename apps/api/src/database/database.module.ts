import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDatabase, type DatabaseConnection } from "@billsafi/db";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";

export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ENV],
      useFactory: (env: Env): DatabaseConnection => createDatabase(env.DATABASE_URL),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.pool.end();
  }
}
