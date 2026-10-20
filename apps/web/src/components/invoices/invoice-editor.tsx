"use client";

import {
  type AllowanceUsage,
  type Client,
  INVOICE_LIMITS,
  type Invoice,
  type InvoiceBusinessDetails,
  type SaveInvoiceInput,
  saveInvoiceSchema,
} from "@billsafi/contracts";
import { calculateInvoice, type InvoiceCalculation } from "@billsafi/domain";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
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
import { InvoicePreview } from "./invoice-preview";

interface EditorItem {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

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

const DECIMAL = /^\d+(\.\d+)?$/;

/** React keys only; never rendered, so they need not match between server and client. */
let itemKeys = 0;

function newItem(item?: Partial<EditorItem>): EditorItem {
  itemKeys += 1;
  return {
    key: itemKeys,
    description: item?.description ?? "",
    quantity: item?.quantity ?? "1",
    unitPrice: item?.unitPrice ?? "",
  };
}

/** Preview totals tolerate half-typed numbers; validation happens on save. */
function previewTotals(
  items: EditorItem[],
  discount: { type: "fixed" | "percentage"; value: string } | null,
  taxRate: string | null,
): { totals: InvoiceCalculation | null; discountError: boolean } {
  const clean = (value: string) => (DECIMAL.test(value.trim()) ? value.trim() : "0");
  try {
    return {
      totals: calculateInvoice({
        items: items.map((item) => ({
          quantity: clean(item.quantity),
          unitPrice: clean(item.unitPrice),
        })),
        discount: discount ? { type: discount.type, value: clean(discount.value) } : null,
        taxRate: taxRate ? clean(taxRate) : null,
      }),
      discountError: false,
    };
  } catch {
    return { totals: null, discountError: true };
  }
}

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
  const [discountOn, setDiscountOn] = useState(Boolean(invoice?.discount));
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">(
    invoice?.discount?.type ?? "fixed",
  );
  const [discountValue, setDiscountValue] = useState(invoice?.discount?.value ?? "");
  const [taxOn, setTaxOn] = useState(Boolean(invoice?.taxRate));
  const [taxRate, setTaxRate] = useState(invoice?.taxRate ?? "16");
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
  const discount = discountOn ? { type: discountType, value: discountValue } : null;
  const { totals, discountError } = useMemo(
    () => previewTotals(items, discount, taxOn ? taxRate : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discount is derived from these
    [items, discountOn, discountType, discountValue, taxOn, taxRate],
  );

  const selectedClient = clients.find((client) => client.id === clientId);
  const previewClient = invoice && clientId === invoice.clientId ? invoice.client : selectedClient;

  function updateItem(key: number, field: keyof Omit<EditorItem, "key">, value: string) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  }

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
      taxRate: taxOn ? taxRate : null,
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
            {errors.items && (
              <p className="mt-2 text-xs text-red-700 dark:text-red-300">{errors.items}</p>
            )}
            <ol className="mt-2">
              {items.map((item, index) => {
                const n = index + 1;
                return (
                  <li
                    key={item.key}
                    aria-label={`Line item ${n}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-x-2 border-b border-line pb-3.5 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_auto]"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <TextField
                        label={n === 1 ? "Description" : `Description ${n}`}
                        value={item.description}
                        error={errors[`items.${index}.description`]}
                        onChange={(event) =>
                          updateItem(item.key, "description", event.target.value)
                        }
                      />
                    </div>
                    <TextField
                      label={n === 1 ? "Qty" : `Qty ${n}`}
                      inputMode="decimal"
                      value={item.quantity}
                      error={errors[`items.${index}.quantity`]}
                      onChange={(event) => updateItem(item.key, "quantity", event.target.value)}
                    />
                    <TextField
                      label={n === 1 ? "Unit price" : `Unit price ${n}`}
                      inputMode="decimal"
                      value={item.unitPrice}
                      error={errors[`items.${index}.unitPrice`]}
                      onChange={(event) => updateItem(item.key, "unitPrice", event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) => current.filter((row) => row.key !== item.key))
                      }
                      className="col-start-3 row-start-1 mt-10 rounded-lg p-1.5 text-sub hover:bg-soft hover:text-ink sm:col-start-auto sm:row-start-auto"
                    >
                      <X aria-hidden className="size-4" />
                      <span className="sr-only">Remove line item {n}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Button
              type="button"
              variant="ghost"
              className="mt-3"
              disabled={items.length >= INVOICE_LIMITS.maxItems}
              onClick={() => setItems((current) => [...current, newItem()])}
            >
              <Plus aria-hidden className="size-4" />
              Add line item
            </Button>

            <div className="mt-3.5 border-t border-line pt-3.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={discountOn}
                  onChange={(event) => setDiscountOn(event.target.checked)}
                  className="accent-teal"
                />
                Add discount <span className="text-xs text-sub">Optional</span>
              </label>
              {discountOn && (
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Discount type"
                    value={discountType}
                    onChange={(event) =>
                      setDiscountType(event.target.value as "fixed" | "percentage")
                    }
                  >
                    <option value="fixed">Fixed amount (KES)</option>
                    <option value="percentage">Percentage</option>
                  </SelectField>
                  <TextField
                    label="Discount"
                    inputMode="decimal"
                    value={discountValue}
                    error={errors["discount.value"]}
                    onChange={(event) => setDiscountValue(event.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="mt-3.5 border-t border-line pt-3.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={taxOn}
                  onChange={(event) => setTaxOn(event.target.checked)}
                  className="accent-teal"
                />
                Add tax <span className="text-xs text-sub">Optional</span>
              </label>
              {taxOn && (
                <TextField
                  label="Tax rate (%)"
                  inputMode="decimal"
                  value={taxRate}
                  error={errors.taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                />
              )}
            </div>
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
            discountLabel={
              discountOn
                ? discountType === "percentage"
                  ? `Discount (${discountValue || 0}%)`
                  : "Discount"
                : null
            }
            taxRate={taxOn ? taxRate : null}
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
