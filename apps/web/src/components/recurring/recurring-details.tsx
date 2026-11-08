"use client";

import {
  type RecurringInvoice,
  invoiceStatusLabels,
  recurringFrequencyLabels,
  type InvoiceStatus,
} from "@billsafi/contracts";
import { CirclePause, CirclePlay, Crown, Pencil, SkipForward, StopCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { formatAmount, formatDate, formatMoney } from "@/lib/format";
import { RecurringStatusPill } from "./recurring-status";

type Action = "pause" | "resume" | "skip" | "end";

export function RecurringDetails({
  businessId,
  recurring,
  isPro,
}: {
  businessId: string;
  recurring: RecurringInvoice;
  isPro: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const base = `/${businessId}/recurring`;
  const { status } = recurring;
  const open = status !== "ended";

  async function run(action: Action) {
    setPending(action);
    setError("");
    try {
      await apiPost<RecurringInvoice>(
        `/businesses/${businessId}/recurring-invoices/${recurring.id}/${action}`,
        {},
      );
      setConfirmEnd(false);
      router.refresh();
    } catch (failure) {
      setConfirmEnd(false);
      setError(
        failure instanceof ApiError && failure.code === "PRO_REQUIRED"
          ? "This needs Pro. Upgrade to continue."
          : failure instanceof ApiError
            ? failure.message
            : "Something went wrong.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-200">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <p className="text-xs text-sub">
            <Link href={base} className="hover:underline">
              Recurring
            </Link>{" "}
            / {recurring.clientName}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {recurring.clientName}
            <RecurringStatusPill status={status} pausedReason={recurring.pausedReason} />
          </h1>
          <p className="mt-1 text-sm text-sub">
            {recurringFrequencyLabels[recurring.frequency]} · {formatMoney(recurring.total)} ·{" "}
            {recurring.mode === "draft" ? "Makes drafts" : "Makes ready invoices"}
          </p>
        </div>
        {open && (
          <div className="flex flex-wrap gap-2">
            {status === "active" ? (
              <Button
                type="button"
                variant="secondary"
                pending={pending === "pause"}
                disabled={pending !== null}
                onClick={() => run("pause")}
              >
                <CirclePause aria-hidden className="size-4" />
                Pause
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                pending={pending === "resume"}
                disabled={pending !== null}
                onClick={() => run("resume")}
              >
                <CirclePlay aria-hidden className="size-4" />
                Resume
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              pending={pending === "skip"}
              disabled={pending !== null || recurring.nextRunDate === null}
              onClick={() => run("skip")}
            >
              <SkipForward aria-hidden className="size-4" />
              Skip next
            </Button>
            <Link
              href={`${base}/${recurring.id}/edit`}
              className="inline-flex items-center gap-2 rounded-panel border border-line bg-panel px-3.75 py-2.75 text-sm font-medium hover:bg-soft"
            >
              <Pencil aria-hidden className="size-4" />
              Edit
            </Link>
            <Button
              type="button"
              variant="ghost"
              disabled={pending !== null}
              onClick={() => setConfirmEnd(true)}
            >
              <StopCircle aria-hidden className="size-4" />
              End
            </Button>
          </div>
        )}
      </div>

      {!isPro && open && (
        <p className="mb-3.5 rounded-panel border border-line bg-soft p-3.5 text-sm text-accent">
          <Crown aria-hidden className="mr-1.5 inline-block size-4 align-text-bottom" />
          Resuming and editing need Pro.{" "}
          <Link href="/billing" className="font-medium underline">
            Upgrade to Pro
          </Link>
        </p>
      )}
      <div aria-live="polite">
        <FormMessage>{error}</FormMessage>
      </div>

      <section className="mt-5 mb-3.5 rounded-panel border border-line bg-panel p-5">
        <h2 className="text-base font-semibold">Next invoices</h2>
        {recurring.upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-sub">None left.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {recurring.upcoming.map((date) => (
              <li key={date}>{formatDate(date)}</li>
            ))}
          </ul>
        )}
        <dl className="mt-4 grid gap-2 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-sub">Started</dt>
            <dd>{formatDate(recurring.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-sub">Ends</dt>
            <dd>
              {recurring.maxCount !== null
                ? `After ${recurring.maxCount} invoices`
                : recurring.endDate
                  ? formatDate(recurring.endDate)
                  : "Never"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-sub">Payment terms</dt>
            <dd>{recurring.paymentTermsDays} days</dd>
          </div>
          <div>
            <dt className="text-xs text-sub">Made so far</dt>
            <dd>{recurring.generatedCount}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-label="Invoices made"
        className="overflow-hidden rounded-panel border border-line bg-panel"
      >
        <h2 className="p-5 pb-3 text-base font-semibold">Invoices made</h2>
        {recurring.invoices.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-sub">Nothing yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs text-sub">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">
                  Invoice
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Period
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Total · KES
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {recurring.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${businessId}/invoices/${invoice.id}`}
                      className="font-medium hover:text-accent hover:underline"
                    >
                      {invoice.invoiceNumber ?? "Draft"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sub">{formatDate(invoice.periodDate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatAmount(invoice.total)}
                  </td>
                  <td className="px-4 py-3 text-sub">
                    {invoiceStatusLabels[invoice.status as InvoiceStatus] ?? invoice.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End this schedule?"
        description="No more invoices will be made. Invoices already made stay."
      >
        <div className="mt-5 flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => setConfirmEnd(false)}>
            Keep schedule
          </Button>
          <Button
            type="button"
            variant="danger"
            pending={pending === "end"}
            onClick={() => run("end")}
          >
            End schedule
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
