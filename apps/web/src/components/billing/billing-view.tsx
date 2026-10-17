"use client";

import type {
  BillingOverview,
  SubscriptionPayment,
  SubscriptionPurpose,
} from "@tallynest/contracts";
import { CREDIT_PACK, PRO_PLAN } from "@tallynest/domain";
import { CircleCheck, CircleX, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiRequest } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/format";

const POLL_MS = 3000;
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

/** Shows 07XX XXX XXX for a stored +2547XXXXXXXX number. */
function localPhone(stored: string): string {
  const local = `0${stored.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

interface BillingViewProps {
  billing: BillingOverview;
  defaultPhone: string;
  businessNames: string[];
}

/** Account billing (D038, D051): plan, usage, M-Pesa checkout, credits, and history. */
export function BillingView({ billing, defaultPhone, businessNames }: BillingViewProps) {
  const router = useRouter();
  const { usage, subscription } = billing;
  const onPro = subscription.status !== "free";
  const [checkout, setCheckout] = useState<SubscriptionPurpose | null>(null);
  const [phone, setPhone] = useState(() => localPhone(defaultPhone));
  const [phoneError, setPhoneError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<SubscriptionPayment | null>(billing.pendingPayment);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

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

  async function changePlan(action: "cancel" | "resume") {
    setChangingPlan(true);
    setFormError(undefined);
    try {
      await apiPost(`/billing/${action}`, {});
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong.");
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

  return (
    <div className="mx-auto max-w-225">
      <div className="mb-6.25">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          One plan. All your businesses.
        </h1>
        <p className="mt-1.25 text-sm text-sub">
          Manage your subscription and monthly invoice allowance.
        </p>
      </div>

      {subscription.renewalDue && subscription.paidUntil && (
        <div
          role="status"
          className="mb-4.5 rounded-panel border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Your Pro access ends on {formatInstant(subscription.paidUntil)}. Renew to keep 100
          invoices a month. Nothing is charged automatically.
        </div>
      )}

      <div className="grid gap-4.5 md:grid-cols-2">
        <section
          aria-labelledby="current-plan"
          className="rounded-panel border border-line bg-panel p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="current-plan" className="text-lg font-semibold">
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
            {onPro ? formatMoney(PRO_PLAN.price).replace(".00", "") : "KES 0"}{" "}
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
                  ? "Your Pro access has ended. Free allows 10 invoices this calendar month, including any already made Ready on Pro. Your records are all still here."
                  : "Each invoice counts when first marked Ready. Drafts and payment recording do not use extra allowance."}
          </div>

          {subscription.status === "active" && (
            <Button
              variant="ghost"
              className="mt-3.5 px-0"
              pending={changingPlan}
              onClick={() => changePlan("cancel")}
            >
              Cancel Pro
            </Button>
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
            <h2 id="pro-offer" className="text-lg font-semibold">
              {onPro ? "Keep Pro going" : "Upgrade to Pro"}
            </h2>
            <span className="rounded-md bg-soft px-2.25 py-1 text-xs text-accent">
              Account-wide
            </span>
          </div>
          <p className="my-3.25 text-3xl font-semibold tracking-tight">
            KES 500 <span className="text-sm font-normal tracking-normal text-sub">/ month</span>
          </p>
          <ul className="text-sm">
            {[
              `${PRO_PLAN.invoiceLimit} invoices per subscription month`,
              "Covers all your businesses",
              "PDFs, sharing, clients & payment recording",
            ].map((feature) => (
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
            {CREDIT_PACK.invoices} extra invoices for{" "}
            {formatMoney(CREDIT_PACK.price).replace(".00", "")}. Credits never expire and are used
            only after your plan allowance runs out.
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
              {formatMoney(checkout === "pro_month" ? PRO_PLAN.price : CREDIT_PACK.price)}
            </span>
          </div>
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
          <FormMessage>{formError}</FormMessage>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button type="button" variant="secondary" onClick={() => setCheckout(null)}>
              Cancel
            </Button>
            <Button type="submit" pending={sending}>
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
            <div className="flex gap-3">
              <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <h2 className="text-base font-semibold">Waiting for payment confirmation</h2>
                <p className="mt-1 text-sm text-sub">
                  Approve the {formatMoney(payment.amount)} request on {localPhone(payment.phone)}.{" "}
                  {payment.purpose === "pro_month"
                    ? "Pro activates after your payment is confirmed."
                    : "Credits are added after your payment is confirmed."}
                </p>
                <p className="mt-1 text-xs text-sub">
                  {waitedTooLong
                    ? "This is taking longer than usual. We'll keep checking, so you can come back later."
                    : "Your payment can still be confirmed if you close this page."}
                </p>
              </div>
            </div>
          )}
          {payment.status === "succeeded" && (
            <div className="flex gap-3">
              <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <h2 className="text-base font-semibold">Payment confirmed</h2>
                <p className="mt-1 text-sm text-sub">
                  {payment.purpose === "pro_month" && payment.grantedUntil
                    ? `Pro is active until ${formatInstant(payment.grantedUntil)}.`
                    : `${payment.creditsGranted} invoice credits were added to your account.`}
                  {payment.receipt && ` M-Pesa receipt ${payment.receipt}.`}
                </p>
              </div>
            </div>
          )}
          {payment.status === "failed" && (
            <div className="flex gap-3">
              <CircleX
                aria-hidden
                className="mt-0.5 size-5 shrink-0 text-red-700 dark:text-red-300"
              />
              <div>
                <h2 className="text-base font-semibold">Payment was not completed</h2>
                <p className="mt-1 text-sm text-sub">
                  {payment.resultDescription ? `${payment.resultDescription}. ` : ""}
                  {payment.purpose === "pro_month"
                    ? "Pro has not been activated."
                    : "No credits were added."}{" "}
                  You can try again.
                </p>
              </div>
            </div>
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
        {billing.payments.length === 0 ? (
          <p className="border-t border-line p-5 text-sm text-sub">
            Your M-Pesa payments to TallyNest will show here.
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
              {billing.payments.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3.5 text-sub">
                    {shortFormat.format(new Date(row.confirmedAt ?? row.createdAt))}
                  </td>
                  <td className="px-5 py-3.5">
                    {purposeLabels[row.purpose]}
                    {row.status === "failed" && (
                      <span className="block text-xs text-red-700 dark:text-red-300">
                        Not completed
                      </span>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 text-sub sm:table-cell">{row.receipt}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{formatMoney(row.amount)}</td>
                </tr>
              ))}
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
