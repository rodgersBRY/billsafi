import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

export interface DatabaseConnection {
  db: Database;
  pool: pg.Pool;
}

export function createDatabase(connectionString: string): DatabaseConnection {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}
