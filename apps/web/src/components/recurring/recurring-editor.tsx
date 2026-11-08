"use client";

import {
  type Client,
  type RecurringFrequency,
  type RecurringInvoice,
  type RecurringMode,
  type SaveRecurringInvoiceInput,
  recurringFrequencies,
  recurringFrequencyLabels,
} from "@billsafi/contracts";
import { upcomingRunDates } from "@billsafi/domain";
import { Crown, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientForm } from "@/components/clients/client-form";
import { type Adjustments, AdjustmentsFields } from "@/components/invoices/adjustments-fields";
import {
  type Discount,
  type EditorItem,
  newItem,
  previewTotals,
  toItemInput,
} from "@/components/invoices/editor-items";
import { LineItemsFields } from "@/components/invoices/line-items-fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiSend } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/format";
import { formatRunDate } from "./run-date";

/** Starting values copied from an invoice. */
export interface RecurringPrefill {
  clientId: string;
  items: { description: string; quantity: string; unitPrice: string; savedItemId: string | null }[];
  discount: Discount;
  taxRate: string | null;
  notes: string | null;
  paymentInstructions: string | null;
}

export interface RecurringEditorProps {
  businessId: string;
  businessName: string;
  today: string;
  clients: Client[];
  isPro: boolean;
  defaultMode: RecurringMode;
  defaultPaymentTermsDays: number;
  defaultPaymentInstructions: string;
  /** Existing schedule; omit when creating. */
  recurring?: RecurringInvoice;
  prefill?: RecurringPrefill;
  onCreated?: () => void;
}

type Errors = Record<string, string>;
type EndMode = "never" | "count" | "date";

/** A fresh key after each create starts the next form blank (pages stay mounted). */
export function NewRecurringEditor(props: Omit<RecurringEditorProps, "recurring">) {
  const [round, setRound] = useState(0);
  return <RecurringEditor key={round} {...props} onCreated={() => setRound((n) => n + 1)} />;
}

export function RecurringEditor(props: RecurringEditorProps) {
  const { businessId, recurring, prefill } = props;
  const router = useRouter();
  const [clients, setClients] = useState(props.clients);
  const [clientId, setClientId] = useState(recurring?.clientId ?? prefill?.clientId ?? "");
  const [frequency, setFrequency] = useState<RecurringFrequency>(recurring?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(recurring?.startDate ?? props.today);
  const [endMode, setEndMode] = useState<EndMode>(
    recurring?.maxCount != null ? "count" : recurring?.endDate ? "date" : "never",
  );
  const [maxCount, setMaxCount] = useState(recurring?.maxCount?.toString() ?? "12");
  const [endDate, setEndDate] = useState(recurring?.endDate ?? "");
  const [mode, setMode] = useState<RecurringMode>(recurring?.mode ?? props.defaultMode);
  const [terms, setTerms] = useState(
    String(recurring?.paymentTermsDays ?? props.defaultPaymentTermsDays),
  );
  const source = recurring ?? prefill;
  const [items, setItems] = useState<EditorItem[]>(() =>
    source?.items.length
      ? source.items.map((item) =>
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
    discountOn: Boolean(source?.discount),
    discountType: source?.discount?.type ?? "fixed",
    discountValue: source?.discount?.value ?? "",
    taxOn: Boolean(source?.taxRate),
    taxRate: source?.taxRate ?? "16",
  }));
  const [paymentInstructions, setPaymentInstructions] = useState(
    source ? (source.paymentInstructions ?? "") : props.defaultPaymentInstructions,
  );
  const [notes, setNotes] = useState(source?.notes ?? "");

  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [needsPro, setNeedsPro] = useState(false);
  const [addingClient, setAddingClient] = useState(false);

  const discount: Discount = adjustments.discountOn
    ? { type: adjustments.discountType, value: adjustments.discountValue }
    : null;
  const taxRate = adjustments.taxOn ? adjustments.taxRate : null;
  const { totals } = useMemo(
    () => previewTotals(items, discount, taxRate),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discount and taxRate are derived from these
    [items, adjustments],
  );

  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [];
    return upcomingRunDates(
      {
        startDate,
        frequency,
        nextIndex: 0,
        endDate: endMode === "date" && endDate ? endDate : null,
        maxCount: endMode === "count" && /^\d+$/.test(maxCount) ? Number(maxCount) : null,
        generatedCount: 0,
      },
      3,
    );
  }, [startDate, frequency, endMode, endDate, maxCount]);

  function body(): RecurringBody {
    return {
      clientId,
      frequency,
      mode,
      startDate,
      endDate: endMode === "date" ? endDate : null,
      // A blank field goes as "" so the API reports it instead of reading it as null.
      maxCount: endMode === "count" ? numberOrBlank(maxCount) : null,
      paymentTermsDays: numberOrBlank(terms),
      items: items.map(toItemInput),
      discount,
      taxRate,
      notes,
      paymentInstructions,
    };
  }

  async function onSave() {
    setErrors({});
    setNeedsPro(false);
    setPending(true);
    try {
      const path = `/businesses/${businessId}/recurring-invoices`;
      const saved = recurring
        ? await apiSend<RecurringInvoice>("PUT", `${path}/${recurring.id}`, body())
        : await apiPost<RecurringInvoice>(path, body());
      router.replace(`/${businessId}/recurring/${saved.id}`);
      router.refresh();
      if (!recurring) props.onCreated?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === "PRO_REQUIRED") {
        setNeedsPro(true);
      } else if (error instanceof ApiError && error.issues.length) {
        setErrors(error.fieldErrors());
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
    } finally {
      setPending(false);
    }
  }

  const title = recurring ? "Edit schedule" : "New recurring invoice";
  const locked = !props.isPro || needsPro;

  return (
    <div className="mx-auto max-w-200">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">
            {props.businessName} /{" "}
            <Link href={`/${businessId}/recurring`} className="hover:underline">
              Recurring
            </Link>{" "}
            / {recurring ? "Edit" : "New"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-sub">
            {recurring
              ? "Changes apply to future invoices only."
              : "Set it once. We make the invoices."}
          </p>
        </div>
        <Button type="button" pending={pending} disabled={locked} onClick={onSave}>
          {recurring ? "Save changes" : "Start schedule"}
        </Button>
      </div>

      {locked && (
        <p
          role="alert"
          className="rounded-panel border border-line bg-soft p-3.5 text-sm text-accent"
        >
          <Crown aria-hidden className="mr-1.5 inline-block size-4 align-text-bottom text-gold" />
          Recurring invoices are a Pro feature.{" "}
          <Link href="/billing" className="font-medium underline">
            Upgrade to Pro
          </Link>
        </p>
      )}
      <div aria-live="polite">
        <FormMessage>{errors.form}</FormMessage>
      </div>

      <fieldset disabled={pending} className="mt-5 min-w-0">
        <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
          <h2 className="text-base font-semibold">Client &amp; schedule</h2>
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
                {recurring && !clients.some((client) => client.id === recurring.clientId) && (
                  <option value={recurring.clientId}>{recurring.clientName} (archived)</option>
                )}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
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
          <div className="grid gap-x-3 sm:grid-cols-2">
            <SelectField
              label="Repeats"
              value={frequency}
              error={errors.frequency}
              onChange={(event) => setFrequency(event.target.value as RecurringFrequency)}
            >
              {recurringFrequencies.map((value) => (
                <option key={value} value={value}>
                  {recurringFrequencyLabels[value]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="First invoice on"
              type="date"
              value={startDate}
              error={errors.startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <SelectField
              label="Ends"
              value={endMode}
              onChange={(event) => setEndMode(event.target.value as EndMode)}
            >
              <option value="never">Never</option>
              <option value="count">After a number of invoices</option>
              <option value="date">On a date</option>
            </SelectField>
            {endMode === "count" && (
              <TextField
                label="Number of invoices"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={maxCount}
                error={errors.maxCount}
                onChange={(event) => setMaxCount(event.target.value)}
              />
            )}
            {endMode === "date" && (
              <TextField
                label="Last date"
                type="date"
                value={endDate}
                error={errors.endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            )}
          </div>
          {preview.length > 0 && (
            <p className="mt-3.5 text-sm text-sub">
              Next invoices: {preview.map(formatRunDate).join(", ")}
            </p>
          )}
        </section>

        <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
          <h2 className="text-base font-semibold">Each invoice</h2>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <SelectField
              label="Make it as"
              value={mode}
              error={errors.mode}
              hint={
                mode === "draft"
                  ? "You review it before it goes out."
                  : "Numbered and ready to send."
              }
              onChange={(event) => setMode(event.target.value as RecurringMode)}
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
            </SelectField>
            <TextField
              label="Payment terms (days)"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={terms}
              error={errors.paymentTermsDays}
              onChange={(event) => setTerms(event.target.value)}
            />
          </div>
        </section>

        <section className="mb-3.5 rounded-panel border border-line bg-panel p-5">
          <h2 className="text-base font-semibold">Line items</h2>
          <p className="mt-1 text-xs text-sub">
            Use {"{month}"} and {"{year}"} to fill in the period.
          </p>
          <LineItemsFields
            businessId={businessId}
            items={items}
            onChange={setItems}
            errors={errors}
          />
          <AdjustmentsFields value={adjustments} onChange={setAdjustments} errors={errors} />
          {totals && (
            <p className="mt-3.5 flex justify-between border-t border-line pt-3.5 text-sm font-medium">
              <span>Each invoice</span>
              <span className="tabular-nums">{formatMoney(totals.total)}</span>
            </p>
          )}
        </section>

        <section className="rounded-panel border border-line bg-panel p-5">
          <h2 className="text-base font-semibold">Notes &amp; payment</h2>
          <TextAreaField
            label="Note · Optional"
            value={notes}
            error={errors.notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <TextAreaField
            label="Payment instructions · Optional"
            value={paymentInstructions}
            error={errors.paymentInstructions}
            onChange={(event) => setPaymentInstructions(event.target.value)}
          />
        </section>
      </fieldset>

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
    </div>
  );
}

type RecurringBody = Omit<SaveRecurringInvoiceInput, "maxCount" | "paymentTermsDays"> & {
  maxCount: number | "" | null;
  paymentTermsDays: number | "";
};

function numberOrBlank(value: string): number | "" {
  return value.trim() ? Number(value) : "";
}
