"use client";

import type {
  BillingGrant,
  BillingOverview,
  CancelProInput,
  SubscriptionPayment,
  SubscriptionPurpose,
} from "@billsafi/contracts";
import { Check, Crown, Minus } from "lucide-react";
import {
  CREDIT_PACK,
  FREE_PLAN,
  type PriceCurrency,
  PRO_PLAN,
  priceCurrencies,
} from "@billsafi/domain";
import { CancelProDialog } from "./cancel-pro-dialog";
import { PaymentFailed, PaymentSucceeded, PaymentWaiting } from "./payment-status";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiRequest } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/format";
import { PLAN_COMPARISON, PRO_FEATURES, type PlanFeatureRow } from "@/lib/plan-features";

const POLL_MS = 3000;
const CURRENCY_KEY = "billsafi.priceCurrency";
/** Stop polling after this long; the backend still settles the payment later. */
const POLL_LIMIT_MS = 3 * 60 * 1000;

const instantFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

const shortFormat = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

function formatInstant(iso: string): string {
  return instantFormat.format(new Date(iso));
}

const purposeLabels: Record<SubscriptionPurpose, string> = {
  pro_month: "Pro, one month",
  invoice_credits: `${CREDIT_PACK.invoices} invoice credits`,
};

const methodLabels: Record<NonNullable<SubscriptionPayment["method"]>, string> = {
  mpesa_direct: "M-Pesa",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

/** What a payment bought; manual payments can cover several months or packs. */
function paymentLabel(payment: SubscriptionPayment): string {
  if (payment.quantity <= 1) return purposeLabels[payment.purpose];
  return payment.purpose === "pro_month"
    ? `Pro, ${payment.quantity} months`
    : `${payment.quantity * CREDIT_PACK.invoices} invoice credits`;
}

function grantLabel(grant: BillingGrant): string {
  if (grant.kind === "invoice_credits") return `${grant.quantity} complimentary invoice credits`;
  return grant.quantity === 1
    ? "Complimentary Pro month"
    : `${grant.quantity} complimentary Pro months`;
}

/** Payments and gifts in one list, newest first. */
type HistoryRow =
  | { kind: "payment"; at: string; payment: SubscriptionPayment }
  | { kind: "grant"; at: string; grant: BillingGrant };

function historyRows(billing: BillingOverview): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...billing.payments.map((payment): HistoryRow => ({
      kind: "payment",
      at: payment.confirmedAt ?? payment.createdAt,
      payment,
    })),
    ...billing.grants.map((grant): HistoryRow => ({ kind: "grant", at: grant.createdAt, grant })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/** This visit's choice, kept even when the browser blocks storage. */
let chosenCurrency: PriceCurrency | null = null;
const currencyListeners = new Set<() => void>();

/** The viewer's chosen price currency; USD until they pick one. */
function priceCurrency(): PriceCurrency {
  if (chosenCurrency) return chosenCurrency;
  try {
    const value = localStorage.getItem(CURRENCY_KEY);
    return priceCurrencies.find((code) => code === value) ?? "USD";
  } catch {
    return "USD";
  }
}

function choosePriceCurrency(code: PriceCurrency) {
  chosenCurrency = code;
  try {
    localStorage.setItem(CURRENCY_KEY, code);
  } catch {
    // The choice still applies for this visit.
  }
  currencyListeners.forEach((listener) => listener());
}

function subscribeToCurrency(listener: () => void) {
  currencyListeners.add(listener);
  return () => {
    currencyListeners.delete(listener);
  };
}

/** Shows 07XX XXX XXX for a stored +2547XXXXXXXX number. */
function localPhone(stored: string): string {
  const local = `0${stored.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** A check, a dash, or a value such as "Up to 5". */
function PlanCell({ value }: { value: PlanFeatureRow["free"] }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="ml-auto size-4 text-teal" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="ml-auto size-4 text-sub" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="tabular-nums">{value}</span>;
}

/** Side-by-side list of what Free and Pro include. */
function PlanComparison({ currentPlan }: { currentPlan: "free" | "pro" }) {
  const planHeading = (plan: "free" | "pro") => (
    <th scope="col" className="w-20 px-3 py-3 text-right align-top font-normal sm:w-36 sm:px-5">
      <span className="inline-flex items-center gap-1.5">
        {plan === "pro" && <Crown aria-hidden className="size-3.5 text-gold" />}
        {plan === "pro" ? "Pro" : "Free"}
      </span>
      {currentPlan === plan && <span className="block text-accent">Your plan</span>}
    </th>
  );
  return (
    <section
      aria-labelledby="compare-plans"
      className="mt-4.5 overflow-hidden rounded-panel border border-line bg-panel"
    >
      <h2 id="compare-plans" className="px-5 py-4.75 text-base font-semibold">
        What each plan includes
      </h2>
      <table className="w-full text-sm">
        <thead className="bg-background text-left text-xs text-sub">
          <tr>
            <th scope="col" className="px-5 py-3 font-normal">
              Feature
            </th>
            {planHeading("free")}
            {planHeading("pro")}
          </tr>
        </thead>
        <tbody>
          {PLAN_COMPARISON.map((row) => (
            <tr key={row.feature} className="border-t border-line">
              <th scope="row" className="py-3.25 pr-3 pl-5 text-left font-normal sm:pr-5">
                {row.feature}
              </th>
              <td className="px-3 py-3.25 text-right sm:px-5">
                <PlanCell value={row.free} />
              </td>
              <td className="px-3 py-3.25 text-right sm:px-5">
                <PlanCell value={row.pro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface BillingViewProps {
  billing: BillingOverview;
  defaultPhone: string;
  businessNames: string[];
}

/** Account billing (D038, D051): plan, usage, M-Pesa checkout, credits, and history. */
export function BillingView({ billing, defaultPhone, businessNames }: BillingViewProps) {
  const router = useRouter();
  const { usage, subscription, prices } = billing;
  const onPro = subscription.status !== "free";
  const [checkout, setCheckout] = useState<SubscriptionPurpose | null>(null);
  const [phone, setPhone] = useState(() => localPhone(defaultPhone));
  const [phoneError, setPhoneError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<SubscriptionPayment | null>(billing.pendingPayment);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string>();
  const [cancelNoteError, setCancelNoteError] = useState<string>();
  // The server renders USD; the browser then applies any saved choice.
  const currency = useSyncExternalStore(subscribeToCurrency, priceCurrency, () => "USD" as const);

  // Poll a pending payment until the backend confirms or fails it.
  useEffect(() => {
    if (payment?.status !== "pending") return;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        clearInterval(timer);
        setWaitedTooLong(true);
        return;
      }
      try {
        const latest = await apiRequest<SubscriptionPayment>(`/billing/payments/${payment.id}`);
        if (latest.status !== "pending") {
          clearInterval(timer);
          setPayment(latest);
          router.refresh();
        }
      } catch {
        // Keep waiting; a network blip should not end the checkout.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [payment?.id, payment?.status, router]);

  async function sendRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!checkout) return;
    setSending(true);
    setPhoneError(undefined);
    setFormError(undefined);
    try {
      const started = await apiPost<SubscriptionPayment>("/billing/checkout", {
        purpose: checkout,
        phone,
      });
      setWaitedTooLong(false);
      setPayment(started);
      setCheckout(null);
    } catch (error) {
      if (error instanceof ApiError && error.issues.length) {
        setPhoneError(error.fieldErrors().phone);
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  async function changePlan(action: "cancel" | "resume", body: CancelProInput = {}) {
    setChangingPlan(true);
    setFormError(undefined);
    setCancelError(undefined);
    setCancelNoteError(undefined);
    try {
      await apiPost(`/billing/${action}`, body);
      setCancelOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Something went wrong.";
      if (action === "cancel" && cancelOpen) {
        if (error instanceof ApiError && error.issues.length) {
          setCancelNoteError(error.fieldErrors().note);
        }
        setCancelError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setChangingPlan(false);
    }
  }

  function startCheckout(purpose: SubscriptionPurpose) {
    setCheckout(purpose);
    setFormError(undefined);
    if (payment?.status !== "pending") setPayment(null);
  }

  const percent = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const shared =
    businessNames.length > 1
      ? `Shared across ${businessNames.slice(0, -1).join(", ")} and ${businessNames.at(-1)}`
      : "Covers every business you add";
  const paymentPending = payment?.status === "pending";
  const history = historyRows(billing);
  // KES prices need a rate; fall back to USD while none is available.
  const shownCurrency: PriceCurrency = currency === "KES" && prices.kes ? "KES" : "USD";
  const shownPrices = shownCurrency === "KES" ? prices.kes! : prices.usd;
  const price = (purpose: SubscriptionPurpose) =>
    formatMoney(shownPrices[purpose], shownCurrency).replace(".00", "");
  const rate = prices.usdKesRate ? Number(prices.usdKesRate).toFixed(2) : null;
  const checkoutCharge = checkout && prices.kes ? prices.kes[checkout] : null;

  return (
    <div className="mx-auto max-w-225">
      <div className="mb-6.25 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            One plan. All your businesses.
          </h1>
          <p className="mt-1.25 text-sm text-sub">
            Manage your subscription and monthly invoice allowance.
          </p>
        </div>
        <div role="group" aria-label="Show prices in" className="flex gap-1.5">
          {priceCurrencies.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={shownCurrency === code}
              disabled={code === "KES" && !prices.kes}
              title={code === "KES" && !prices.kes ? "Exchange rate unavailable" : undefined}
              onClick={() => choosePriceCurrency(code)}
              className="rounded-md border border-line bg-panel px-2.75 py-1.25 text-xs disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-soft aria-pressed:text-accent"
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {subscription.renewalDue && subscription.paidUntil && (
        <div
          role="status"
          className="mb-4.5 rounded-panel border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Your Pro access ends on {formatInstant(subscription.paidUntil)}. Renew to keep{" "}
          {PRO_PLAN.invoiceLimit} invoices a month. Nothing is charged automatically.
        </div>
      )}

      <div className="grid gap-4.5 md:grid-cols-2">
        <section
          aria-labelledby="current-plan"
          className="rounded-panel border border-line bg-panel p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="current-plan" className="flex items-center gap-2 text-lg font-semibold">
              {onPro && <Crown aria-hidden className="size-4.5 text-gold" />}
              {onPro ? "Pro" : "Free"}
            </h2>
            <span className="rounded-md bg-soft px-2.25 py-1 text-xs text-accent">
              {subscription.status === "cancelled"
                ? "Ends soon"
                : subscription.status === "free" && subscription.paidUntil
                  ? "Pro expired"
                  : "Current plan"}
            </span>
          </div>
          <p className="my-3.25 text-3xl font-semibold tracking-tight">
            {onPro ? price("pro_month") : `${shownCurrency} 0`}{" "}
            <span className="text-sm font-normal tracking-normal text-sub">/ month</span>
          </p>
          <p className="text-sm text-sub">
            {onPro ? "Your account is on Pro." : "Everything you need to start invoicing."}
          </p>

          <div className="mt-5.5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>
                {usage.plan === "pro" ? "Invoices this Pro month" : "Invoices this month"}
              </span>
              <span className="tabular-nums">
                {usage.used} / {usage.limit}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Invoices used"
              aria-valuemin={0}
              aria-valuemax={usage.limit}
              aria-valuenow={usage.used}
              className="my-2.75 h-1.5 rounded-lg bg-line"
            >
              <div className="h-full rounded-lg bg-teal" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-sub">
              {shared}. Resets {formatInstant(usage.periodEnd)}.
            </p>
            {usage.extraInvoices > 0 && usage.extraEndsAt && (
              <p className="mt-1.5 text-xs text-sub">
                BillSafi raised your limit from {usage.planLimit} to {usage.limit} until{" "}
                {formatInstant(usage.extraEndsAt)}.
              </p>
            )}
            {usage.credits > 0 && (
              <p className="mt-1.5 text-xs text-sub">
                Plus {usage.credits} invoice credits, used after the plan allowance runs out.
              </p>
            )}
          </div>

          <div className="mt-5.5 rounded-panel bg-soft p-3.75 text-xs text-sub">
            {subscription.status === "active" && subscription.paidUntil
              ? `Active until ${formatInstant(subscription.paidUntil)}. Renew early to extend from this date.`
              : subscription.status === "cancelled" && subscription.paidUntil
                ? `Cancelled. Pro stays active until ${formatInstant(subscription.paidUntil)}, then your account returns to Free.`
                : subscription.paidUntil
                  ? `Your Pro access has ended. Free allows ${FREE_PLAN.invoiceLimit} invoices this calendar month, including any already made Ready on Pro. Your records are all still here.`
                  : "Each invoice counts when first marked Ready. Drafts and payment recording do not use extra allowance."}
          </div>

          {subscription.status === "active" && (
            <Button
              variant="ghost"
              className="mt-3.5 px-0"
              onClick={() => {
                setCancelError(undefined);
                setCancelNoteError(undefined);
                setCancelOpen(true);
              }}
            >
              Cancel Pro
            </Button>
          )}
          {subscription.status === "active" && subscription.paidUntil && (
            <CancelProDialog
              open={cancelOpen}
              until={formatInstant(subscription.paidUntil)}
              pending={changingPlan}
              error={cancelError}
              noteError={cancelNoteError}
              onClose={() => setCancelOpen(false)}
              onConfirm={(feedback) => changePlan("cancel", feedback)}
            />
          )}
          {subscription.status === "cancelled" && (
            <Button
              variant="secondary"
              className="mt-3.5"
              pending={changingPlan}
              onClick={() => changePlan("resume")}
            >
              Keep Pro
            </Button>
          )}
        </section>

        <section
          aria-labelledby="pro-offer"
          className="rounded-panel border border-t-3 border-line border-t-teal bg-panel p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="pro-offer" className="flex items-center gap-2 text-lg font-semibold">
              <Crown aria-hidden className="size-4.5 text-gold" />
              {onPro ? "Keep Pro going" : "Upgrade to Pro"}
            </h2>
            <span className="rounded-md bg-soft px-2.25 py-1 text-xs text-accent">
              Account-wide
            </span>
          </div>
          <p className="my-3.25 text-3xl font-semibold tracking-tight">
            {price("pro_month")}{" "}
            <span className="text-sm font-normal tracking-normal text-sub">/ month</span>
          </p>
          <ul className="text-sm">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="border-b border-line py-2.25 last:border-b-0">
                {feature}
              </li>
            ))}
          </ul>
          <Button
            className="mt-5 w-full"
            disabled={paymentPending}
            onClick={() => startCheckout("pro_month")}
          >
            {onPro ? "Renew with M-Pesa" : "Continue with M-Pesa"}
          </Button>
          <p className="mt-3 text-xs text-sub">
            {prices.kes
              ? shownCurrency === "USD"
                ? `Charged as ${formatMoney(prices.kes.pro_month)} with M-Pesa at today's rate. `
                : `Set at ${formatMoney(prices.usd.pro_month, "USD")}, converted at today's rate. `
              : "Charged in KES with M-Pesa at the day's exchange rate. "}
            Renew each month with your approval. No automatic deductions.
          </p>
        </section>
      </div>

      <section
        aria-labelledby="credits"
        className="mt-4.5 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-panel p-6"
      >
        <div>
          <h2 id="credits" className="text-base font-semibold">
            Need more invoices?
          </h2>
          <p className="mt-1 text-sm text-sub">
            {CREDIT_PACK.invoices} extra invoices for {price("invoice_credits")}. Credits never
            expire and are used only after your plan allowance runs out.
          </p>
          <p className="mt-1 text-xs text-sub">You have {usage.credits} credits.</p>
        </div>
        <Button
          variant="secondary"
          disabled={paymentPending}
          onClick={() => startCheckout("invoice_credits")}
        >
          Buy credits
        </Button>
      </section>

      <PlanComparison currentPlan={onPro ? "pro" : "free"} />

      {checkout && (
        <form
          onSubmit={sendRequest}
          aria-labelledby="checkout-title"
          className="mt-4.5 rounded-panel border border-line bg-panel p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="checkout-title" className="text-lg font-semibold">
              {checkout === "pro_month" ? "Pay for Pro" : "Buy invoice credits"}
            </h2>
            <span className="font-medium">
              {checkoutCharge
                ? formatMoney(checkoutCharge)
                : formatMoney(prices.usd[checkout], "USD")}
            </span>
          </div>
          {checkoutCharge && (
            <p className="mt-1 text-xs text-sub">
              {formatMoney(prices.usd[checkout], "USD")} at KES {rate} per USD. M-Pesa charges in
              KES.
            </p>
          )}
          <p className="mt-1 text-sm text-sub">
            {checkout === "pro_month"
              ? onPro
                ? "One more month of Pro, added after your current end date."
                : "One month of Pro for your account and all its businesses."
              : `${CREDIT_PACK.invoices} invoices to use after your plan allowance runs out.`}
          </p>
          <TextField
            label="M-Pesa phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07XX XXX XXX"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={phoneError}
            hint="A payment request will be sent to this phone for approval."
            required
          />
          <FormMessage>
            {formError ??
              (checkoutCharge
                ? undefined
                : "We couldn't get today's exchange rate, so M-Pesa payments are paused. Please try again in a few minutes.")}
          </FormMessage>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setCheckout(null)}>
              Cancel
            </Button>
            <Button type="submit" pending={sending} disabled={!checkoutCharge}>
              Send payment request
            </Button>
          </div>
        </form>
      )}

      {!checkout && formError && <FormMessage>{formError}</FormMessage>}

      {payment && (
        <section
          aria-live="polite"
          className="mt-4.5 rounded-panel border border-line bg-panel p-5"
        >
          {payment.status === "pending" && (
            <PaymentWaiting
              amount={formatMoney(payment.amount)}
              phone={localPhone(payment.phone ?? "")}
              note={
                payment.purpose === "pro_month"
                  ? "Pro activates once it's confirmed."
                  : "Credits are added once it's confirmed."
              }
              waitedTooLong={waitedTooLong}
            />
          )}
          {payment.status === "succeeded" && (
            <PaymentSucceeded
              title={
                payment.purpose === "pro_month" && payment.grantedUntil
                  ? `Pro is active until ${formatInstant(payment.grantedUntil)}.`
                  : `${payment.creditsGranted} invoice credits added.`
              }
              rows={[
                { label: "Amount", value: formatMoney(payment.amount) },
                ...(payment.receipt
                  ? [{ label: "M-Pesa receipt", value: payment.receipt, mono: true }]
                  : []),
              ]}
              onDone={() => setPayment(null)}
            />
          )}
          {payment.status === "failed" && (
            <PaymentFailed
              reason={payment.resultDescription}
              note={
                payment.purpose === "pro_month"
                  ? "Pro has not been activated."
                  : "No credits were added."
              }
              onRetry={() => startCheckout(payment.purpose)}
              onClose={() => setPayment(null)}
            />
          )}
        </section>
      )}

      <section
        aria-labelledby="history"
        className="mt-4.5 overflow-hidden rounded-panel border border-line bg-panel"
      >
        <h2 id="history" className="px-5 py-4.75 text-base font-semibold">
          Payment history
        </h2>
        {history.length === 0 ? (
          <p className="border-t border-line p-5 text-sm text-sub">
            Your payments to BillSafi will show here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs text-sub">
              <tr>
                <th scope="col" className="px-5 py-3 font-normal">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-normal">
                  For
                </th>
                <th scope="col" className="hidden px-5 py-3 font-normal sm:table-cell">
                  Receipt
                </th>
                <th scope="col" className="px-5 py-3 text-right font-normal">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) =>
                row.kind === "grant" ? (
                  <tr key={`grant-${row.grant.id}`} className="border-t border-line">
                    <td className="px-5 py-3.5 text-sub">{shortFormat.format(new Date(row.at))}</td>
                    <td className="px-5 py-3.5">
                      {grantLabel(row.grant)}
                      <span className="block text-xs text-sub">From BillSafi</span>
                      {row.grant.endedEarly && row.grant.grantedUntil && (
                        <span className="block text-xs text-sub">
                          Ended early on {formatInstant(row.grant.grantedUntil)}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3.5 text-sub sm:table-cell" />
                    <td className="px-5 py-3.5 text-right text-sub">No charge</td>
                  </tr>
                ) : (
                  <tr key={row.payment.id} className="border-t border-line">
                    <td className="px-5 py-3.5 text-sub">{shortFormat.format(new Date(row.at))}</td>
                    <td className="px-5 py-3.5">
                      {paymentLabel(row.payment)}
                      {row.payment.source === "manual" && (
                        <span className="block text-xs text-sub">
                          Recorded by BillSafi
                          {row.payment.method && ` · ${methodLabels[row.payment.method]}`}
                        </span>
                      )}
                      {row.payment.endedEarly && row.payment.grantedUntil && (
                        <span className="block text-xs text-sub">
                          Ended early on {formatInstant(row.payment.grantedUntil)}
                        </span>
                      )}
                      {row.payment.status === "failed" && (
                        <span className="block text-xs text-red-700 dark:text-red-300">
                          Not completed
                        </span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3.5 text-sub sm:table-cell">
                      {row.payment.receipt}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatMoney(row.payment.amount, row.payment.currency)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-5 text-xs text-sub">
        If Pro expires, your records stay available. You can still share existing invoices and
        record payments.
      </p>
    </div>
  );
}
