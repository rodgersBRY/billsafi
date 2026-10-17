import "server-only";
import type { Client } from "@tallynest/contracts";
import { apiGet, businessPath, query } from "./request";

export function listClients(
  businessId: string,
  filter: { status?: "active" | "archived"; search?: string } = {},
): Promise<Client[]> {
  return apiGet<Client[]>(`${businessPath(businessId)}/clients${query(filter)}`);
}
