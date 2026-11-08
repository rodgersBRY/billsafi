import type { SavedItem } from "@billsafi/contracts";
import type { schema } from "@billsafi/db";

type SavedItemRow = typeof schema.savedItems.$inferSelect;

export function toSavedItem(row: SavedItemRow): SavedItem {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
