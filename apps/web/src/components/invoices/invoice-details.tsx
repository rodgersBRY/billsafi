"use client";

import {
  type Invoice,
  type InvoiceLinkStatus,
  type Payment,
  receivedPaymentMethodLabels,
} from "@tallynest/contracts";
import { calculateInvoice } from "@tallynest/domain";
import { Ban, ChevronDown, Lock, Pencil, Plus, Share2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaymentForm, ReversePaymentForm } from "@/components/payments/payment-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { StatusPill } from "@/components/ui/status-pill";
import { apiPost, apiSend } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { formatAmount, formatDate } from "@/lib/format";
import { InvoicePreview } from "./invoice-preview";
import { ShareDialog } from "./share-dialog";

interface InvoiceDetailsProps {
  businessId: string;
  invoice: Invoice;
  payments: Payment[];
  link: InvoiceLinkStatus | null;
  today: string;
}

type Open =
  | { kind: "record" }
  | { kind: "correct"; payment: Payment }
  | { kind: "reverse"; payment: Payment }
  | { kind: "share" }
  | { kind: "cancel" }
  | null;

function PaymentValues({
  values,
}: {
  values: Payment | Payment["changes"][number]["previousValues"];
}) {
  return (
    <>
      KES {formatAmount(values.amount)} · {receivedPaymentMethodLabels[values.method]} ·{" "}
      {formatDate(values.paymentDate)}
      {values.reference ? ` · ${values.reference}` : ""}
    </>
  );
}

export function InvoiceDetails({
  businessId,
  invoice,
  payments,
  link,
  today,
}: InvoiceDetailsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [notesMessage, setNotesMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"notes" | "cancel" | null>(null);

  const base = `/businesses/${businessId}/invoices/${invoice.id}`;
  const canRecord = invoice.status === "ready" || invoice.status === "partially_paid";
  const canShare = invoice.status !== "draft" && invoice.status !== "cancelled";
  const canEdit = invoice.status === "ready" && !invoice.financialsLocked;
  const canCancel = invoice.status === "ready";
  const close = () => setOpen(null);
  const saved = () => {
    setOpen(null);
    router.refresh();
  };

  async function saveNotes(event: React.FormEvent) {
    event.preventDefault();
    setPending("notes");
    setNotesMessage("");
    try {
      await apiSend<Invoice>("PATCH", `${base}/notes`, { notes });
      setNotesMessage("Notes saved.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  async function cancelInvoice() {
    setPending("cancel");
    try {
      await apiPost<Invoice>(`${base}/cancel`, {});
      saved();
    } catch (failure) {
      setOpen(null);
      setError(failure instanceof ApiError ? failure.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  const totals = calculateInvoice({
    items: invoice.items,
    discount: invoice.discount,
    taxRate: invoice.taxRate,
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">
            <Link href={`/${businessId}/invoices`} className="hover:underline">
              Invoices
            </Link>{" "}
            / {invoice.invoiceNumber}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {invoice.invoiceNumber}
            <StatusPill status={invoice.status} overdue={invoice.overdue} />
          </h1>
          <p className="mt-1 text-sm text-sub">
            {invoice.client.name} · due {formatDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRecord && (
            <Button type="button" onClick={() => setOpen({ kind: "record" })}>
              <Plus aria-hidden className="size-4" />
              Record payment
            </Button>
          )}
          {canShare && (
            <Button type="button" variant="secondary" onClick={() => setOpen({ kind: "share" })}>
              <Share2 aria-hidden className="size-4" />
              Share
            </Button>
          )}
          {canEdit && (
            <Link
              href={`/${businessId}/invoices/${invoice.id}/edit`}
              className="inline-flex items-center gap-2 rounded-panel border border-line bg-panel px-3.75 py-2.75 text-sm font-medium hover:bg-soft"
            >
              <Pencil aria-hidden className="size-4" />
              Edit
            </Link>
          )}
          {canCancel && (
            <Button type="button" variant="ghost" onClick={() => setOpen({ kind: "cancel" })}>
              <Ban aria-hidden className="size-4" />
              Cancel invoice
            </Button>
          )}
        </div>
      </div>
      <FormMessage>{error}</FormMessage>

      <div className="mt-4 grid gap-5.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3.5">
          <section aria-label="Balance" className="rounded-panel border border-line bg-panel p-5">
            <dl className="grid grid-cols-3 gap-3 tabular-nums">
              <div>
                <dt className="text-xs text-sub">Invoice total · KES</dt>
                <dd className="mt-1 text-lg font-semibold">{formatAmount(invoice.total)}</dd>
              </div>
              <div>
                <dt className="text-xs text-sub">Payments received · KES</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {formatAmount(invoice.paymentsReceived)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-sub">Balance due · KES</dt>
                <dd className="mt-1 text-lg font-semibold">{formatAmount(invoice.balanceDue)}</dd>
              </div>
            </dl>
            <p className="mt-4 flex gap-2 text-xs text-sub">
              {invoice.status === "cancelled" ? (
                "This invoice is cancelled and retained for your records."
              ) : invoice.financialsLocked ? (
                <>
                  <Lock aria-hidden className="size-3.5 shrink-0" />
                  Payments have been recorded. Client, line items, discount, and tax are locked;
                  notes remain editable.
                </>
              ) : (
                "No payments recorded."
              )}
            </p>
          </section>

          <section className="rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">Payments</h2>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-sub">No payments yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {payments.map((payment) => (
                  <li key={payment.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className={payment.reversedAt ? "text-sub line-through" : undefined}>
                        <p className="text-sm tabular-nums">
                          <PaymentValues values={payment} />
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {payment.reversedAt ? (
                          <span className="rounded-md bg-background px-1.75 py-1 text-xs text-sub">
                            Reversed
                          </span>
                        ) : (
                          invoice.status !== "cancelled" && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen({ kind: "correct", payment })}
                              >
                                <Pencil aria-hidden className="size-4" />
                                Correct
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen({ kind: "reverse", payment })}
                              >
                                <Undo2 aria-hidden className="size-4" />
                                Reverse
                              </Button>
                            </>
                          )
                        )}
                      </div>
                    </div>
                    {payment.changes.length > 0 && (
                      <details className="group mt-1.5 text-xs text-sub">
                        <summary className="flex cursor-pointer list-none items-center gap-1">
                          <ChevronDown
                            aria-hidden
                            className="size-3.5 transition-transform group-open:rotate-180"
                          />
                          {payment.changes.some((change) => change.kind === "correction")
                            ? "Corrected"
                            : "History"}{" "}
                          · {payment.changes.length} change{payment.changes.length > 1 ? "s" : ""}
                        </summary>
                        <ol className="mt-2 space-y-2 border-l border-line pl-3">
                          {payment.changes.map((change) => (
                            <li key={change.createdAt}>
                              <p className="font-medium text-ink">
                                {change.kind === "correction" ? "Corrected" : "Reversed"}{" "}
                                {formatDate(change.createdAt.slice(0, 10))}
                              </p>
                              <p>
                                Before: <PaymentValues values={change.previousValues} />
                              </p>
                              {change.newValues && (
                                <p>
                                  After: <PaymentValues values={change.newValues} />
                                </p>
                              )}
                              <p>Reason: {change.reason}</p>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {invoice.status !== "cancelled" && (
            <form
              method="post"
              onSubmit={saveNotes}
              className="rounded-panel border border-line bg-panel p-5"
            >
              <h2 className="text-base font-semibold">Notes</h2>
              <TextAreaField
                label="Note on the invoice · Optional"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <FormMessage tone="success">{notesMessage}</FormMessage>
              <div className="mt-4 flex justify-end">
                <Button type="submit" variant="secondary" pending={pending === "notes"}>
                  Save notes
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="min-w-0">
          <InvoicePreview
            business={invoice.business}
            client={invoice.client}
            invoiceNumber={invoice.invoiceNumber}
            status={invoice.status}
            overdue={invoice.overdue}
            issueDate={invoice.issueDate}
            dueDate={invoice.dueDate}
            items={invoice.items}
            totals={totals}
            discountLabel={
              invoice.discount
                ? invoice.discount.type === "percentage"
                  ? `Discount (${Number(invoice.discount.value)}%)`
                  : "Discount"
                : null
            }
            taxRate={invoice.taxRate ? String(Number(invoice.taxRate)) : null}
            paymentInstructions={invoice.paymentInstructions ?? ""}
            notes={invoice.notes ?? ""}
            paymentsReceived={invoice.paymentsReceived}
            balanceDue={invoice.balanceDue}
          />
        </div>
      </div>

      <Dialog open={open?.kind === "record"} onClose={close} title="Record payment">
        {open?.kind === "record" && (
          <PaymentForm
            businessId={businessId}
            invoiceId={invoice.id}
            today={today}
            balanceDue={invoice.balanceDue}
            onCancel={close}
            onSaved={saved}
          />
        )}
      </Dialog>
      <Dialog
        open={open?.kind === "correct"}
        onClose={close}
        title="Correct payment"
        description="The previous values and your reason are kept in the payment history."
      >
        {open?.kind === "correct" && (
          <PaymentForm
            businessId={businessId}
            invoiceId={invoice.id}
            today={today}
            balanceDue={invoice.balanceDue}
            payment={open.payment}
            onCancel={close}
            onSaved={saved}
          />
        )}
      </Dialog>
      <Dialog open={open?.kind === "reverse"} onClose={close} title="Reverse this payment?">
        {open?.kind === "reverse" && (
          <ReversePaymentForm
            businessId={businessId}
            invoiceId={invoice.id}
            payment={open.payment}
            onCancel={close}
            onSaved={saved}
          />
        )}
      </Dialog>
      <Dialog
        open={open?.kind === "cancel"}
        onClose={close}
        title="Cancel this invoice?"
        description={`${invoice.invoiceNumber} will be kept for your records and its number won't be reused. It still counts toward this month's allowance, and its public link stops working.`}
      >
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close}>
            Keep invoice
          </Button>
          <Button type="button" pending={pending === "cancel"} onClick={cancelInvoice}>
            Cancel invoice
          </Button>
        </div>
      </Dialog>
      {open?.kind === "share" && (
        <ShareDialog open onClose={close} businessId={businessId} invoice={invoice} link={link} />
      )}
    </>
  );
}
