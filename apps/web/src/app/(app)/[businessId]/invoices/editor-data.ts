import "server-only";
import { connection } from "next/server";
import type { InvoiceEditorProps } from "@/components/invoices/invoice-editor";
import { getBusiness, getUsage, listClients, listPaymentInstructions } from "@/lib/api.server";
import { todayInNairobi } from "@/lib/format";
import { paymentInstructionsText } from "@/lib/payment-instructions";

/** Everything the editor needs besides the invoice itself. */
export async function loadEditorData(businessId: string): Promise<InvoiceEditorProps> {
  await connection();
  const [business, clients, instructions, usage] = await Promise.all([
    getBusiness(businessId),
    listClients(businessId, { status: "active" }),
    listPaymentInstructions(businessId),
    getUsage(),
  ]);
  return {
    businessId,
    business: {
      displayName: business.displayName,
      contactEmail: business.contactEmail,
      phone: business.phone,
      address: business.address,
      kraPin: business.kraPin,
      logoKey: business.logoKey,
    },
    defaultPaymentTermsDays: business.defaultPaymentTermsDays,
    defaultPaymentInstructions: paymentInstructionsText(instructions),
    today: todayInNairobi(),
    clients,
    usage,
  };
}
