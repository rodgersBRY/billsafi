import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listSavedItems } from "@/lib/server-api/items";
import { ItemsView } from "./items-view";

export const metadata: Metadata = { title: "Items · BillSafi" };

async function Items({ params, searchParams }: PageProps<"/[businessId]/items">) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const status = query.status === "archived" ? "archived" : "active";
  const search = typeof query.q === "string" ? query.q : "";
  const items = await listSavedItems(businessId, { status, search: search || undefined });
  return <ItemsView businessId={businessId} items={items} status={status} search={search} />;
}

export default function ItemsPage(props: PageProps<"/[businessId]/items">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Items {...props} />
    </Suspense>
  );
}
