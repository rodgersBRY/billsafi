import { formatDocumentNumber } from "./document-number.js";

/** Five-digit padding from the start; larger numbers grow without truncation (D048). */
export function formatInvoiceNumber(sequence: number): string {
  return formatDocumentNumber("INV", sequence);
}
