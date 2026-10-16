import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { DatabaseConnection } from "@tallynest/db";
import { sql } from "drizzle-orm";
import { DATABASE } from "../database/database.module.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  @Get()
  async check() {
    try {
      await this.connection.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException({ status: "error", database: "unreachable" });
    }

    return { status: "ok", database: "ok" };
  }
}
