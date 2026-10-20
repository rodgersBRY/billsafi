/** Escapes LIKE wildcards so user search text matches literally. */
export function containsPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
