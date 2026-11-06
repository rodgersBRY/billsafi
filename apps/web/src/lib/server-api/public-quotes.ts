import "server-only";
import type { PublicQuote } from "@billsafi/contracts";
import { parseApiResponse } from "../api-error";
import { apiInternalUrl } from "./request";

/**
 * Account-free quote view. Sends no cookies; any unusable link
 * (unknown, replaced, disabled, draft, withdrawn) returns null.
 */
export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  const response = await fetch(
    `${apiInternalUrl}/api/v1/public/quotes/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  return parseApiResponse<PublicQuote>(response);
}
