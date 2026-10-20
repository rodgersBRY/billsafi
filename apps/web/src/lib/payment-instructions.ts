import type { PaymentInstruction } from "@billsafi/contracts";
import { formatKenyanPhone } from "@billsafi/domain";

/** Default invoice text from the business's latest saved payment details. */
export function paymentInstructionsText(instructions: PaymentInstruction[]): string {
  const latest = instructions.at(-1);
  if (!latest) return "";

  const lines: string[] = [];

  switch (latest.method) {
    case "mpesa_personal":
      lines.push(`M-Pesa: ${formatKenyanPhone(latest.accountNumber!)}`);
      break;
    case "mpesa_till":
      lines.push(`M-Pesa Till: ${latest.accountNumber}`);
      break;
    case "mpesa_paybill":
      lines.push(`M-Pesa Paybill: ${latest.accountNumber}`);
      break;
    case "bank_transfer":
      break;
  }

  if (latest.instructions) lines.push(latest.instructions);

  return lines.join("\n");
}
