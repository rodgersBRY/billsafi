import "server-only";
import type { RecurringEditorProps } from "@/components/recurring/recurring-editor";
import { getUsage } from "@/lib/server-api/billing";
import { getBusiness, listPaymentInstructions } from "@/lib/server-api/businesses";
import { listClients } from "@/lib/server-api/clients";
import { todayInNairobi } from "@/lib/format";
import { paymentInstructionsText } from "@/lib/payment-instructions";
import { connection } from "next/server";

/** Everything the schedule form needs besides the schedule itself. */
export async function loadRecurringEditorData(
  businessId: string,
): Promise<Omit<RecurringEditorProps, "recurring" | "prefill">> {
  await connection();
  const [business, clients, instructions, usage] = await Promise.all([
    getBusiness(businessId),
    listClients(businessId, { status: "active" }),
    listPaymentInstructions(businessId),
    getUsage(),
  ]);
  return {
    businessId,
    businessName: business.displayName,
    today: todayInNairobi(),
    clients,
    isPro: usage.plan === "pro",
    defaultMode: business.defaultRecurringMode,
    defaultPaymentTermsDays: business.defaultPaymentTermsDays,
    defaultPaymentInstructions: paymentInstructionsText(instructions),
  };
}
