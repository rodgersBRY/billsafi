import type { Metadata } from "next";
import { FinishImport } from "@/components/generator/finish-import";

export const metadata: Metadata = {
  title: "Saving your invoice · Billsafi",
  robots: { index: false },
};

/** Where sign-up from the generator lands; the proxy requires a session here. */
export default function FinishGuestInvoicePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <FinishImport />
    </main>
  );
}
