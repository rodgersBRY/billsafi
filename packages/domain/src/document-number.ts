/** Five-digit padding from the start; larger numbers grow without truncation (D048). */
export function formatDocumentNumber(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("Document sequence must be a positive integer");
  }
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}
