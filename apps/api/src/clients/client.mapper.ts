import type { Client } from "@billsafi/contracts";
import type { schema } from "@billsafi/db";

type ClientRow = typeof schema.clients.$inferSelect;

export function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    companyName: row.companyName,
    address: row.address,
    kraPin: row.kraPin,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
