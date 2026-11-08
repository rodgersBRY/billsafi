import "server-only";
import type { SavedItem } from "@billsafi/contracts";
import { apiGet, businessPath, query } from "./request";

export function listSavedItems(
  businessId: string,
  filter: { status?: "active" | "archived"; search?: string } = {},
): Promise<SavedItem[]> {
  return apiGet<SavedItem[]>(`${businessPath(businessId)}/items${query(filter)}`);
}
