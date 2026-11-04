import "server-only";
import type {
  Quote,
  QuoteLinkStatus,
  QuoteStatus,
  QuoteSummary,
  QuoteVersion,
} from "@billsafi/contracts";
import { apiGet, businessPath, query, quotePath } from "./request";

export function listQuotes(
  businessId: string,
  filter: { status?: QuoteStatus | "expired"; search?: string } = {},
): Promise<QuoteSummary[]> {
  return apiGet<QuoteSummary[]>(`${businessPath(businessId)}/quotes${query(filter)}`);
}

export function getQuote(businessId: string, quoteId: string): Promise<Quote> {
  return apiGet<Quote>(quotePath(businessId, quoteId));
}

export function getQuoteVersion(
  businessId: string,
  quoteId: string,
  version: number,
): Promise<QuoteVersion> {
  return apiGet<QuoteVersion>(`${quotePath(businessId, quoteId)}/versions/${version}`);
}

export async function getQuoteLink(
  businessId: string,
  quoteId: string,
): Promise<QuoteLinkStatus | null> {
  return (await apiGet<{ link: QuoteLinkStatus | null }>(`${quotePath(businessId, quoteId)}/link`))
    .link;
}
