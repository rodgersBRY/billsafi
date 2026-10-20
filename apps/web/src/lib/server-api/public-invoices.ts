import "server-only";
import type { PublicInvoice } from "@billsafi/contracts";
import { parseApiResponse } from "../api-error";
import { apiInternalUrl } from "./request";

/**
 * Account-free invoice view (D011). Sends no cookies; any unusable link
 * (expired, replaced, disabled, draft, cancelled) returns null.
 */
export async function getPublicInvoice(token: string): Promise<PublicInvoice | null> {
  const response = await fetch(
    `${apiInternalUrl}/api/v1/public/invoices/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  return parseApiResponse<PublicInvoice>(response);
}
