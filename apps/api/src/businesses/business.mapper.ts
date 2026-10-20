import type { Business, PaymentInstruction } from "@billsafi/contracts";
import type { schema } from "@billsafi/db";

type BusinessRow = typeof schema.businesses.$inferSelect;
type PaymentInstructionRow = typeof schema.businessPaymentInstructions.$inferSelect;

/** Public shape: leaves out owner and numbering internals. */
export function toBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    profileType: row.profileType,
    displayName: row.displayName,
    contactEmail: row.contactEmail,
    phone: row.phone,
    address: row.address,
    kraPin: row.kraPin,
    logoKey: row.logoKey,
    defaultCurrency: row.defaultCurrency,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPaymentInstruction(row: PaymentInstructionRow): PaymentInstruction {
  return {
    id: row.id,
    method: row.method,
    accountNumber: row.accountNumber,
    instructions: row.instructions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
