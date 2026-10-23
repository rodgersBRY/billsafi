"use client";

import { importGuestInvoiceSchema } from "@billsafi/contracts";
import { normalizeKenyanPhone } from "@billsafi/domain";
import { Download } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AdjustmentsFields } from "@/components/invoices/adjustments-fields";
import { discountLabel, previewTotals } from "@/components/invoices/editor-items";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { LineItemsFields } from "@/components/invoices/line-items-fields";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { addDays, todayInNairobi } from "@/lib/format";
import { GuestAuthDialog } from "./guest-auth-dialog";
import { GuestBusinessFields } from "./guest-business-fields";
import { GuestClientFields } from "./guest-client-fields";
import { readGuestDraft, writeGuestDraft } from "./guest-draft";
import {
  discountOf,
  type Errors,
  emptyGuestForm,
  fromGuestDraft,
  type GuestForm,
  taxRateOf,
  toGuestDraft,
} from "./guest-form-state";

const DEFAULT_TERMS_DAYS = 14;
const SAVE_DELAY_MS = 300;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function GuestInvoiceForm({ google }: { google: ReactNode }) {
  const [form, setForm] = useState<GuestForm>(emptyGuestForm);
  const [restored, setRestored] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [authOpen, setAuthOpen] = useState(false);
  const checkOnRestore = useRef(false);

  const set = (patch: Partial<GuestForm>) => setForm((current) => ({ ...current, ...patch }));
  const discount = discountOf(form);
  const taxRate = taxRateOf(form);
  const { totals, discountError } = useMemo(
    () => previewTotals(form.items, discount, taxRate),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discount and taxRate are derived from these
    [form.items, form.adjustments],
  );

  // Restore first. Saving only starts once this has run, so the empty defaults
  // never overwrite a stored draft.
  useEffect(() => {
    const draft = readGuestDraft();
    // The page is prerendered at build time, so a server date would be the build
    // date. Fill the dates from the visitor's clock instead.
    const today = todayInNairobi();
    const next = draft ? fromGuestDraft(draft) : emptyGuestForm();
    if (!next.issueDate) next.issueDate = today;
    if (!next.dueDate) next.dueDate = addDays(next.issueDate, DEFAULT_TERMS_DAYS);
    // The finish page sends people back with ?check=1 when the API rejected the draft.
    checkOnRestore.current = new URLSearchParams(window.location.search).get("check") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage once on mount
    setForm(next);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (checkOnRestore.current) {
      checkOnRestore.current = false;
      validate();
    }
    const timer = window.setTimeout(() => writeGuestDraft(toGuestDraft(form)), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validate reads the same form state
  }, [restored, form]);

  function validate(): boolean {
    const result = importGuestInvoiceSchema.safeParse(toGuestDraft(form));
    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        next[issue.path.join(".")] ??= issue.message;
      }
    }
    // Zod skips the invoice-level checks when any invoice field fails to parse,
    // so repeat them here to show every problem in one pass.
    if (form.items.length === 0) next["invoice.items"] ??= "Add at least one line item";
    if (ISO_DATE.test(form.issueDate) && ISO_DATE.test(form.dueDate)) {
      if (form.dueDate < form.issueDate) {
        next["invoice.dueDate"] ??= "Due date can't be before the issue date";
      }
    }
    if (discountError) {
      next["invoice.discount.value"] ??= "The discount cannot be more than the subtotal";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onSave() {
    if (!validate()) return;
    writeGuestDraft(toGuestDraft(form));
    setAuthOpen(true);
  }

  const { business, client } = form;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <>
      <div className="mt-6 grid gap-5.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <GuestBusinessFields
            value={business}
            onChange={(value) => set({ business: value })}
            errors={errors}
          />
          <GuestClientFields
            client={client}
            onClientChange={(value) => set({ client: value })}
            issueDate={form.issueDate}
            dueDate={form.dueDate}
            onDatesChange={set}
            errors={errors}
          />

          <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">What are you billing for?</h2>
            <LineItemsFields
              items={form.items}
              onChange={(items) => set({ items })}
              errors={errors}
              errorPrefix="invoice."
            />
            <AdjustmentsFields
              value={form.adjustments}
              onChange={(adjustments) => set({ adjustments })}
              errors={errors}
              errorPrefix="invoice."
            />
          </section>

          <section className="rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">Payment instructions &amp; notes</h2>
            <TextAreaField
              label="Payment instructions"
              hint="How the client should pay you, like your M-Pesa till or bank details."
              value={form.paymentInstructions}
              error={errors["invoice.paymentInstructions"]}
              onChange={(event) => set({ paymentInstructions: event.target.value })}
            />
            <TextAreaField
              label="Note · Optional"
              value={form.notes}
              error={errors["invoice.notes"]}
              onChange={(event) => set({ notes: event.target.value })}
            />
          </section>

          <div aria-live="polite">
            <FormMessage>
              {hasErrors ? "Some details need fixing before you can save." : null}
            </FormMessage>
          </div>
          <Button type="button" className="mt-4 w-full sm:w-auto" onClick={onSave}>
            <Download aria-hidden className="size-4" />
            Save &amp; download
          </Button>
        </div>

        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 flex justify-between text-xs text-sub">
            <span>Invoice preview</span>
            <span>A4 layout</span>
          </p>
          <InvoicePreview
            business={{
              displayName: business.displayName.trim() || "Your business",
              contactEmail: business.contactEmail,
              phone: normalizeKenyanPhone(business.phone) ?? "",
              address: business.address.trim() || null,
              kraPin: business.kraPin.trim() || null,
              logoKey: null,
            }}
            client={{
              name: client.name.trim() || "Your client",
              companyName: client.companyName.trim() || null,
            }}
            invoiceNumber={null}
            status="draft"
            issueDate={form.issueDate}
            dueDate={form.dueDate}
            items={form.items}
            totals={totals}
            discountLabel={discountLabel(discount)}
            taxRate={taxRate}
            paymentInstructions={form.paymentInstructions}
            notes={form.notes}
          />
          {discountError && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              The discount is more than the subtotal.
            </p>
          )}
        </div>
      </div>

      <GuestAuthDialog open={authOpen} onClose={() => setAuthOpen(false)} google={google} />
    </>
  );
}
