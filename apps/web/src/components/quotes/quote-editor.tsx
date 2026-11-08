"use client";

import {
  type Client,
  type InvoiceBusinessDetails,
  type Quote,
  type SaveQuoteInput,
  type SentQuote,
  saveQuoteSchema,
} from "@billsafi/contracts";
import { QUOTE_VALIDITY_DAYS } from "@billsafi/domain";
import { Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientForm } from "@/components/clients/client-form";
import { type Adjustments, AdjustmentsFields } from "@/components/invoices/adjustments-fields";
import {
  type Discount,
  discountLabel,
  type EditorItem,
  toItemInput,
  newItem,
  previewTotals,
} from "@/components/invoices/editor-items";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { LineItemsFields } from "@/components/invoices/line-items-fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { QuoteStatusPill } from "@/components/ui/quote-status-pill";
import { apiPost, apiSend } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { addDays } from "@/lib/format";
import { logoUrl } from "@/lib/logo";

export interface QuoteEditorProps {
  businessId: string;
  business: InvoiceBusinessDetails;
  today: string;
  clients: Client[];
  /** Existing quote; omit when creating. */
  quote?: Quote;
  /** Called once a new quote has been created. */
  onCreated?: () => void;
}

type Errors = Record<string, string>;

const VALIDITY_CHOICES = [7, 14, 30];

/**
 * Next keeps visited pages mounted (cacheComponents), so the new-quote form would still
 * hold the last quote when someone opens it again. A fresh key after each create starts
 * the next one blank.
 */
export function NewQuoteEditor(props: Omit<QuoteEditorProps, "quote">) {
  const [round, setRound] = useState(0);
  return <QuoteEditor key={round} {...props} onCreated={() => setRound((n) => n + 1)} />;
}

export function QuoteEditor(props: QuoteEditorProps) {
  const { businessId, quote } = props;
  const router = useRouter();
  const [clients, setClients] = useState(props.clients);
  const [clientId, setClientId] = useState(quote?.clientId ?? "");
  const [quoteNumber, setQuoteNumber] = useState(quote?.quoteNumber ?? "");
  const [issueDate, setIssueDate] = useState(quote?.issueDate ?? props.today);
  const [validUntil, setValidUntil] = useState(
    quote?.validUntil ?? addDays(props.today, QUOTE_VALIDITY_DAYS),
  );
  const [validEdited, setValidEdited] = useState(Boolean(quote));
  const [items, setItems] = useState<EditorItem[]>(() =>
    quote?.items.length
      ? quote.items.map((item) =>
          newItem({
            description: item.description,
            quantity: Number(item.quantity).toString(),
            unitPrice: item.unitPrice,
            savedItemId: item.savedItemId,
          }),
        )
      : [newItem()],
  );
  const [adjustments, setAdjustments] = useState<Adjustments>(() => ({
    discountOn: Boolean(quote?.discount),
    discountType: quote?.discount?.type ?? "fixed",
    discountValue: quote?.discount?.value ?? "",
    taxOn: Boolean(quote?.taxRate),
    taxRate: quote?.taxRate ?? "16",
  }));
  const [notes, setNotes] = useState(quote?.notes ?? "");

  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<"save" | "send" | "delete" | null>(null);
  const [saved, setSaved] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A new quote created by Send whose send step failed; retrying must update it, not add another.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const status = quote?.status ?? "draft";
  const isDraft = status === "draft";
  const isExpired = Boolean(quote?.expired);
  const isDeclined = status === "declined";
  const canResend = isDeclined || isExpired;
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
  const previewClient = quote && clientId === quote.clientId ? quote.client : selectedClient;

  function body(): SaveQuoteInput {
    return {
      clientId,
      quoteNumber,
      issueDate,
      validUntil,
      items: items.map(toItemInput),
      discount,
      taxRate,
      notes,
    };
  }

  function validate(requireItems: boolean): boolean {
    const result = saveQuoteSchema.safeParse(body());
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
    if (error instanceof ApiError && error.issues.length) {
      setErrors(error.fieldErrors());
    } else {
      setErrors({ form: "Something went wrong. Please try again." });
    }
  }

  async function save(): Promise<Quote> {
    const path = `/businesses/${businessId}/quotes`;
    const existingId = quote?.id ?? createdId;
    if (existingId) return apiSend<Quote>("PUT", `${path}/${existingId}`, body());
    const created = await apiPost<Quote>(path, body());
    setCreatedId(created.id);
    return created;
  }

  async function onSave() {
    setSaved("");
    if (!validate(!isDraft)) return;
    setPending("save");
    try {
      const result = await save();
      if (!quote) {
        router.replace(`/${businessId}/quotes/${result.id}`);
        props.onCreated?.();
        return;
      }
      if (!isDraft) {
        router.push(`/${businessId}/quotes/${quote.id}`);
        router.refresh();
        return;
      }
      setSaved("Draft saved.");
      router.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  }

  async function onSend() {
    setSaved("");
    if (!validate(true)) return;
    setPending("send");
    try {
      const result = await save();
      const sent = await apiPost<SentQuote>(
        `/businesses/${businessId}/quotes/${result.id}/send`,
        {},
      );
      let share = "";
      if (sent.link) {
        try {
          sessionStorage.setItem(`billsafi:quote-link:${sent.link.id}`, sent.link.token);
        } catch {
          // Private mode: the details page falls back to asking for a new link.
        }
        share = "?share=1";
      }
      router.replace(`/${businessId}/quotes/${result.id}${share}`);
      router.refresh();
      if (!quote) props.onCreated?.();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    if (!quote) return;
    setPending("delete");
    try {
      await apiSend("DELETE", `/businesses/${businessId}/quotes/${quote.id}`);
      router.replace(`/${businessId}/quotes`);
      router.refresh();
    } catch (error) {
      setConfirmDelete(false);
      fail(error);
      setPending(null);
    }
  }

  const title = quote?.quoteNumber ?? (quote ? "Draft quote" : "Create quote");
  const statusLine = isDeclined
    ? "Saving keeps it declined. Save and send to ask again."
    : isExpired
      ? "Pick a new valid-until date, then save and send."
      : status === "sent"
        ? "Client sees changes on the same link."
        : null;
  const business = quote?.business ?? props.business;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">
            {props.business.displayName} / Quotes / {quote ? title : "New quote"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-sub">
            {statusLine ?? "Start with the details. Preview as you go."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quote && isDraft && (
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
          {(isDraft || canResend) && (
            <Button
              type="button"
              pending={pending === "send"}
              disabled={pending !== null}
              onClick={onSend}
            >
              {isDraft ? "Send" : "Save and send"}
            </Button>
          )}
        </div>
      </div>

      <div aria-live="polite">
        <FormMessage>{errors.form}</FormMessage>
        <FormMessage tone="success">{saved}</FormMessage>
      </div>

      <div className="mt-5 grid gap-5.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <fieldset disabled={pending !== null} className="min-w-0">
          <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">Client &amp; dates</h2>
            <TextField
              label="Quote number · Optional"
              value={quoteNumber}
              onChange={(event) => setQuoteNumber(event.target.value)}
              maxLength={80}
              error={errors.quoteNumber}
              hint={
                isDraft
                  ? "Leave blank to number it when you send it."
                  : "Clear to restore the original number."
              }
            />
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
                  {quote && !clients.some((client) => client.id === quote.clientId) && (
                    <option value={quote.clientId}>{quote.client.name} (archived)</option>
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
                  if (!validEdited && event.target.value) {
                    setValidUntil(addDays(event.target.value, QUOTE_VALIDITY_DAYS));
                  }
                }}
              />
              <div>
                <TextField
                  label="Valid until"
                  type="date"
                  value={validUntil}
                  error={errors.validUntil}
                  onChange={(event) => {
                    setValidEdited(true);
                    setValidUntil(event.target.value);
                  }}
                />
                <div className="-mt-2 flex flex-wrap gap-1.5">
                  {VALIDITY_CHOICES.map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => {
                        if (!issueDate) return;
                        setValidEdited(true);
                        setValidUntil(addDays(issueDate, days));
                      }}
                    >
                      {days} days
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">What are you quoting for?</h2>
            <LineItemsFields
              businessId={businessId}
              items={items}
              onChange={setItems}
              errors={errors}
            />
            <AdjustmentsFields value={adjustments} onChange={setAdjustments} errors={errors} />
          </section>

          <section className="rounded-panel border border-line bg-panel p-5">
            <h2 className="text-base font-semibold">Notes</h2>
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
            <span>Quote preview</span>
            <span>A4 layout</span>
          </p>
          <InvoicePreview
            kind="quote"
            business={business}
            logoSrc={business.logoKey ? logoUrl(businessId, business.logoKey) : null}
            client={previewClient ?? null}
            invoiceNumber={quoteNumber.trim() || (isDraft ? null : "Automatic number on save")}
            statusPill={<QuoteStatusPill status={status} expired={quote?.expired} />}
            issueDate={issueDate}
            dueDate={validUntil}
            items={items}
            totals={totals}
            discountLabel={discountLabel(discount)}
            taxRate={taxRate}
            paymentInstructions=""
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
        description="Deleting this draft removes its details."
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
