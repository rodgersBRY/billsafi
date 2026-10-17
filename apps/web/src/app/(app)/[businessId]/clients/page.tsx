import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { listClients } from "@/lib/server-api/clients";
import { ClientsView } from "./clients-view";

export const metadata: Metadata = { title: "Clients · TallyNest" };

async function Clients({ params, searchParams }: PageProps<"/[businessId]/clients">) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const status = query.status === "archived" ? "archived" : "active";
  const search = typeof query.q === "string" ? query.q : "";
  const clients = await listClients(businessId, { status, search: search || undefined });
  return <ClientsView businessId={businessId} clients={clients} status={status} search={search} />;
}

export default function ClientsPage(props: PageProps<"/[businessId]/clients">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Clients {...props} />
    </Suspense>
  );
}
