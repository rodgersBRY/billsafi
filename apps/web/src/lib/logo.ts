/** Owner-only logo URL; logo rows never change, so the id doubles as a cache key (D052). */
export function logoUrl(businessId: string, logoKey: string): string {
  return `/api/v1/businesses/${businessId}/logos/${logoKey}`;
}
