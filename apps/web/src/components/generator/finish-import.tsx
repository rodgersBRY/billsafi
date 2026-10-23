"use client";

import type { ImportGuestInvoiceResult } from "@billsafi/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { clearGuestDraft, readGuestDraft } from "./guest-draft";

/** Saves the generator draft to the new account, then opens it in the editor (D056). */
export function FinishImport() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    const draft = readGuestDraft();
    if (!draft) {
      router.replace("/");
      return;
    }
    setFailed(false);
    try {
      const result = await apiPost<ImportGuestInvoiceResult>("/guest-invoices/import", draft);
      // Clear only after the server has it, so a failure never loses their work.
      clearGuestDraft();
      const existing = result.usedExistingBusiness ? "&existing=1" : "";
      router.replace(
        `/${result.businessId}/invoices/${result.invoiceId}/edit?from=generator${existing}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        // Send them back to fix the fields the API rejected.
        router.replace("/free-invoice-generator?check=1");
        return;
      }
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    // React runs effects twice in development; import only once.
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  if (failed) {
    return (
      <div className="flex max-w-sm flex-col items-center text-center">
        <FormMessage>
          We couldn&apos;t save your invoice. It&apos;s still in this browser.
        </FormMessage>
        <Button type="button" className="mt-5" onClick={() => void run()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <BrandLoader label="Saving your invoice" />
      <p className="text-sm text-sub">Saving your invoice…</p>
    </div>
  );
}
