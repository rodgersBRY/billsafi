import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { RecurringEditor } from "@/components/recurring/recurring-editor";
import { getRecurring } from "@/lib/server-api/recurring";
import { loadRecurringEditorData } from "../../editor-data";

export const metadata: Metadata = { title: "Edit recurring invoice · BillSafi" };

async function EditRecurring({ params }: PageProps<"/[businessId]/recurring/[recurringId]/edit">) {
  const { businessId, recurringId } = await params;
  const recurring = await getRecurring(businessId, recurringId);
  if (recurring.status === "ended") redirect(`/${businessId}/recurring/${recurringId}`);
  const data = await loadRecurringEditorData(businessId);
  return (
    <RecurringEditor
      key={`${recurring.id}:${recurring.updatedAt}`}
      {...data}
      recurring={recurring}
    />
  );
}

export default function EditRecurringPage(
  props: PageProps<"/[businessId]/recurring/[recurringId]/edit">,
) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <EditRecurring {...props} />
    </Suspense>
  );
}
