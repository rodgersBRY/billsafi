/** Five-digit padding from the start; larger numbers grow without truncation (D048). */
export function formatInvoiceNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError("Invoice sequence must be a positive integer");
  }
  return `INV-${String(sequence).padStart(5, "0")}`;
}
