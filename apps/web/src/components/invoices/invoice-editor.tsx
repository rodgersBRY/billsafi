"use client";

import {
  type AllowanceUsage,
  type Client,
  type Invoice,
  type InvoiceBusinessDetails,
  type SaveInvoiceInput,
  saveInvoiceSchema,
} from "@billsafi/contracts";
import { Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiRequest, apiSend } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { addDays, formatDate } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { type Adjustments, AdjustmentsFields } from "./adjustments-fields";
import {
  type Discount,
  discountLabel,
  type EditorItem,
  newItem,
  previewTotals,
} from "./editor-items";
import { InvoicePreview } from "./invoice-preview";
import { LineItemsFields } from "./line-items-fields";

export interface InvoiceEditorProps {
  businessId: string;
  business: InvoiceBusinessDetails;
  defaultPaymentTermsDays: number;
  defaultPaymentInstructions: string;
  today: string;
  clients: Client[];
  usage: AllowanceUsage;
  /** Existing invoice; omit when creating. */
  invoice?: Invoice;
}

type Errors = Record<string, string>;

export function InvoiceEditor(props: InvoiceEditorProps) {
  const { businessId, invoice } = props;
  const router = useRouter();
  const [clients, setClients] = useState(props.clients);
  const [clientId, setClientId] = useState(invoice?.clientId ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? props.today);
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ?? addDays(props.today, props.defaultPaymentTermsDays),
  );
  const [dueEdited, setDueEdited] = useState(Boolean(invoice));
  const [items, setItems] = useState<EditorItem[]>(() =>
    invoice?.items.length
      ? invoice.items.map((item) =>
          newItem({
            description: item.description,
            quantity: Number(item.quantity).toString(),
            unitPrice: item.unitPrice,
          }),
        )
      : [newItem()],
  );
  const [adjustments, setAdjustments] = useState<Adjustments>(() => ({
    discountOn: Boolean(invoice?.discount),
    discountType: invoice?.discount?.type ?? "fixed",
    discountValue: invoice?.discount?.value ?? "",
    taxOn: Boolean(invoice?.taxRate),
    taxRate: invoice?.taxRate ?? "16",
  }));
  const [paymentInstructions, setPaymentInstructions] = useState(
    invoice ? (invoice.paymentInstructions ?? "") : props.defaultPaymentInstructions,
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<"save" | "ready" | "delete" | null>(null);
  const [saved, setSaved] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = invoice?.status ?? "draft";
  const isDraft = status === "draft";
  const editable = status === "draft" || status === "ready";
  const discount: Discount = adjustments.discountOn
    ? { type: adjustments.discountType, value: adjustments.discountValue }
    : null;
  const taxRate = adjustments.taxOn ? adjustments.taxRate : null;
  const { totals, discountError } = useMemo(
    () => previewTotals(items, discount, taxRate),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discount and taxRate are derived from these
    [items, adjustments],
  );

  const selectedClient = clients.find((client) => client.id === clientId);
  const previewClient = invoice && clientId === invoice.clientId ? invoice.client : selectedClient;

  function body(): SaveInvoiceInput {
    return {
      clientId,
      issueDate,
      dueDate,
      items: items.map(({ description, quantity, unitPrice }) => ({
        description,
        quantity,
        unitPrice,
      })),
      discount,
      taxRate,
      paymentInstructions,
      notes,
    };
  }

  function validate(requireItems: boolean): boolean {
    const result = saveInvoiceSchema.safeParse(body());
    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        next[issue.path.join(".")] ??= issue.message;
      }
    }
    if (requireItems && items.length === 0) next.items = "Add at least one line item";
    if (discountError) next["discount.value"] = "The discount cannot be more than the subtotal";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function fail(error: unknown) {
    if (error instanceof ApiError && error.code === "ALLOWANCE_REACHED") {
      setErrors({
        form: `${error.message} Upgrade to Pro or buy invoice credits to keep going.`,
        billing: "true",
      });
    } else if (error instanceof ApiError && error.issues.length) {
      setErrors(error.fieldErrors());
    } else {
      setErrors({ form: "Something went wrong. Please try again." });
    }
  }

  async function save(): Promise<Invoice | null> {
    const path = `/businesses/${businessId}/invoices`;
    return invoice
      ? apiSend<Invoice>("PUT", `${path}/${invoice.id}`, body())
      : apiPost<Invoice>(path, body());
  }

  async function onSave() {
    setSaved("");
    if (!validate(!isDraft)) return;
    setPending("save");
    try {
      const result = await save();
      if (!invoice && result) {
        router.replace(`/${businessId}/invoices/${result.id}`);
        return;
      }
      if (!isDraft && invoice) {
        // Back to the details once a Ready invoice is saved.
        router.push(`/${businessId}/invoices/${invoice.id}`);
        router.refresh();
        return;
      }
      setSaved(isDraft ? "Draft saved." : "Changes saved.");
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  }

  async function onMarkReady() {
    setSaved("");
    if (!validate(true)) return;
    setPending("ready");
    try {
      const result = await save();
      await apiRequest<Invoice>(`/businesses/${businessId}/invoices/${result!.id}/ready`, {
        method: "POST",
      });
      if (!invoice) router.replace(`/${businessId}/invoices/${result!.id}`);
      // Refresh shared layouts too, so the sidebar usage meter counts this invoice.
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    if (!invoice) return;
    setPending("delete");
    try {
      await apiSend("DELETE", `/businesses/${businessId}/invoices/${invoice.id}`);
      router.replace(`/${businessId}/invoices`);
      router.refresh();
    } catch (error) {
      setConfirmDelete(false);
      fail(error);
      setPending(null);
    }
  }

  const remaining = props.usage.limit - props.usage.used;
  const title = invoice?.invoiceNumber ?? (invoice ? "Draft invoice" : "Create invoice");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">
            {props.business.displayName} / Invoices / {invoice ? title : "New invoice"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-sub">
            {isDraft
              ? "Start with the details. Preview as you go."
              : `Marked Ready ${invoice?.readyAt ? formatDate(invoice.readyAt.slice(0, 10)) : ""}. You can edit it until a payment is recorded.`}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            {invoice && isDraft && (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden className="size-4" />
                Delete draft
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              pending={pending === "save"}
              disabled={pending !== null}
              onClick={onSave}
            >
              {isDraft ? "Save draft" : "Save changes"}
            </Button>
            {isDraft && (
              <Button
                type="button"
                pending={pending === "ready"}
                disabled={pending !== null}
                onClick={onMarkReady}
              >
                Mark as Ready
              </Button>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite">
        <FormMessage>{errors.form}</FormMessage>
        {errors.billing && (
          <Link
            href={`/${businessId}/billing`}
            className="mt-2 inline-block text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            Go to Billing
          </Link>
        )}
        <FormMessage tone="success">{saved}</FormMessage>
      </div>
      {isDraft && (
        <p className="mt-2 text-xs text-sub">
          {props.usage.plan === "pro" ? "Pro" : "Free"} plan: {Math.max(remaining, 0)} of{" "}
          {props.usage.limit} invoices left{" "}
          {props.usage.plan === "pro" ? "this Pro month" : "this month"}
          {props.usage.credits > 0 && `, plus ${props.usage.credits} credits`}. An invoice counts
          when you mark it Ready.
        </p>
      )}

      <div className="mt-5 grid gap-5.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <fieldset disabled={!editable || pending !== null} className="min-w-0">
          <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">Client &amp; dates</h2>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <SelectField
                  label="Client"
                  value={clientId}
                  error={errors.clientId}
                  onChange={(event) => setClientId(event.target.value)}
                >
                  <option value="" disabled>
                    Choose a client
                  </option>
                  {invoice && !clients.some((client) => client.id === invoice.clientId) && (
                    <option value={invoice.clientId}>{invoice.client.name} (archived)</option>
                  )}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.companyName && client.companyName !== client.name
                        ? ` · ${client.companyName}`
                        : ""}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button
                type="button"
                variant="secondary"
                className={errors.clientId ? "mb-6" : ""}
                onClick={() => setAddingClient(true)}
              >
                <UserPlus aria-hidden className="size-4" />
                New client
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Issue date"
                type="date"
                value={issueDate}
                error={errors.issueDate}
                onChange={(event) => {
                  setIssueDate(event.target.value);
                  if (!dueEdited && event.target.value) {
                    setDueDate(addDays(event.target.value, props.defaultPaymentTermsDays));
                  }
                }}
              />
              <TextField
                label="Due date"
                type="date"
                value={dueDate}
                error={errors.dueDate}
                onChange={(event) => {
                  setDueEdited(true);
                  setDueDate(event.target.value);
                }}
              />
            </div>
          </section>

          <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">What are you billing for?</h2>
            <LineItemsFields items={items} onChange={setItems} errors={errors} />
            <AdjustmentsFields value={adjustments} onChange={setAdjustments} errors={errors} />
          </section>

          <section className="rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">Payment instructions &amp; notes</h2>
            <TextAreaField
              label="Payment instructions"
              value={paymentInstructions}
              error={errors.paymentInstructions}
              onChange={(event) => setPaymentInstructions(event.target.value)}
            />
            <TextAreaField
              label="Note · Optional"
              value={notes}
              error={errors.notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </section>
        </fieldset>

        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 flex justify-between text-xs text-sub">
            <span>Invoice preview</span>
            <span>A4 layout</span>
          </p>
          <InvoicePreview
            business={invoice?.business ?? props.business}
            logoSrc={
              (invoice?.business ?? props.business).logoKey
                ? logoUrl(businessId, (invoice?.business ?? props.business).logoKey!)
                : null
            }
            client={previewClient ?? null}
            invoiceNumber={invoice?.invoiceNumber ?? null}
            status={status}
            issueDate={issueDate}
            dueDate={dueDate}
            items={items}
            totals={totals}
            discountLabel={discountLabel(discount)}
            taxRate={taxRate}
            paymentInstructions={paymentInstructions}
            notes={notes}
          />
          {discountError && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              The discount is more than the subtotal.
            </p>
          )}
        </div>
      </div>

      <Dialog open={addingClient} onClose={() => setAddingClient(false)} title="Add client">
        {addingClient && (
          <ClientForm
            businessId={businessId}
            onCancel={() => setAddingClient(false)}
            onSaved={(client) => {
              setClients((current) =>
                [...current, client].sort((a, b) => a.name.localeCompare(b.name)),
              );
              setClientId(client.id);
              setAddingClient(false);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this draft?"
        description="Drafts have no invoice number yet, so nothing is kept once it's deleted."
      >
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
            Keep draft
          </Button>
          <Button type="button" pending={pending === "delete"} onClick={onDelete}>
            Delete draft
          </Button>
        </div>
      </Dialog>
    </>
  );
}
