/** The same filters in any order give the same key. */
export function cacheKey(query: object): string {
  return JSON.stringify(Object.entries(query).sort(([a], [b]) => a.localeCompare(b)));
}
