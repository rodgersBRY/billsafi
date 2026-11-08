import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { NewRecurringEditor } from "@/components/recurring/recurring-editor";
import { getInvoice } from "@/lib/server-api/invoices";
import { loadRecurringEditorData } from "../editor-data";

export const metadata: Metadata = { title: "New recurring invoice · BillSafi" };

async function NewRecurring({ params, searchParams }: PageProps<"/[businessId]/recurring/new">) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const from = typeof query.from === "string" ? query.from : undefined;
  const [data, invoice] = await Promise.all([
    loadRecurringEditorData(businessId),
    from ? getInvoice(businessId, from) : undefined,
  ]);
  return (
    <NewRecurringEditor
      key={invoice?.id ?? "blank"}
      {...data}
      prefill={
        invoice && {
          clientId: invoice.clientId,
          items: invoice.items,
          discount: invoice.discount,
          taxRate: invoice.taxRate,
          notes: invoice.notes,
          paymentInstructions: invoice.paymentInstructions,
        }
      }
    />
  );
}

export default function NewRecurringPage(props: PageProps<"/[businessId]/recurring/new">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <NewRecurring {...props} />
    </Suspense>
  );
}
