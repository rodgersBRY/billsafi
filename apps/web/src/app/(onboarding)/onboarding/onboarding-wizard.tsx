"use client";

import {
  type Business,
  type BusinessProfileType,
  createBusinessSchema,
  createPaymentInstructionSchema,
  type PaymentMethod,
  paymentMethodLabels,
  paymentMethods,
} from "@billsafi/contracts";
import { FREE_PLAN } from "@billsafi/domain";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { queueIntroSplash } from "@/components/brand/intro-splash";
import { StepPanel } from "@/components/onboarding/step-panel";
import { Stepper } from "@/components/onboarding/stepper";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost, apiRequest } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

type Step = "business" | "payment" | "done";
type Errors = Record<string, string>;

interface Props {
  user: { name: string; email: string };
  isAdditionalBusiness: boolean;
}

function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  return Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message]));
}

export function OnboardingWizard({ user, isAdditionalBusiness }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("business");
  const [business, setBusiness] = useState<Business | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [profileType, setProfileType] = useState<BusinessProfileType>("individual");
  const [details, setDetails] = useState({
    displayName: isAdditionalBusiness ? "" : user.name,
    contactEmail: user.email,
    phone: "",
    address: "",
    kraPin: "",
  });

  const [method, setMethod] = useState<PaymentMethod>("mpesa_personal");
  const [accountNumber, setAccountNumber] = useState("");
  const [numberEdited, setNumberEdited] = useState(false);
  const [instructions, setInstructions] = useState("");

  function updateDetail(field: keyof typeof details) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setDetails((current) => ({ ...current, [field]: event.target.value }));
  }

  function failWith(error: unknown) {
    setPending(false);
    if (error instanceof ApiError && error.issues.length > 0) {
      setErrors(error.fieldErrors());
    } else {
      setErrors({ form: "Something went wrong. Please try again." });
    }
  }

  async function saveBusiness(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createBusinessSchema.safeParse({ profileType, ...details });
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));

    setPending(true);
    setErrors({});
    try {
      // Going back from payment edits the business created on the first pass.
      const saved = business
        ? await apiRequest<Business>(`/businesses/${business.id}`, {
            method: "PATCH",
            body: JSON.stringify({ profileType, ...details }),
          })
        : await apiPost<Business>("/businesses", { profileType, ...details });
      setBusiness(saved);
      // Prefill the personal M-Pesa number from the profile phone until the user edits it (D032).
      if (!numberEdited && method === "mpesa_personal") setAccountNumber(details.phone);
      setPending(false);
      setStep("payment");
    } catch (error) {
      failWith(error);
    }
  }

  function changeMethod(next: PaymentMethod) {
    setMethod(next);
    setErrors({});
    if (!numberEdited) setAccountNumber(next === "mpesa_personal" ? details.phone : "");
  }

  async function savePayment(event: React.FormEvent) {
    event.preventDefault();
    const body =
      method === "bank_transfer"
        ? { method, instructions }
        : { method, accountNumber, instructions };
    const parsed = createPaymentInstructionSchema.safeParse(body);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));

    setPending(true);
    setErrors({});
    try {
      await apiPost(`/businesses/${business!.id}/payment-instructions`, body);
      setPending(false);
      setStep("done");
    } catch (error) {
      failWith(error);
    }
  }

  function enterApp() {
    queueIntroSplash();
    router.push(`/${business!.id}/overview`);
  }

  if (step === "business") {
    return (
      <>
        <Stepper current={2} />
        <StepPanel
          title={isAdditionalBusiness ? "Add another business" : "How should clients know you?"}
          description={
            isAdditionalBusiness
              ? "Each business keeps its own clients, invoices and numbering."
              : "Set up your first business. You can add more later."
          }
        >
          <form method="post" onSubmit={saveBusiness} noValidate>
            <div role="group" aria-label="Profile type" className="my-5 grid grid-cols-2 gap-2.5">
              {(
                [
                  ["individual", "Individual"],
                  ["business", "Business"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={profileType === type}
                  onClick={() => setProfileType(type)}
                  className="rounded-panel border border-line bg-panel px-3.75 py-2.75 text-sm aria-pressed:border-accent aria-pressed:bg-soft aria-pressed:text-accent"
                >
                  {label}
                </button>
              ))}
            </div>
            <TextField
              label="Display name"
              value={details.displayName}
              onChange={updateDetail("displayName")}
              error={errors.displayName}
              autoComplete="organization"
            />
            <TextField
              label="Contact email"
              type="email"
              value={details.contactEmail}
              onChange={updateDetail("contactEmail")}
              error={errors.contactEmail}
              autoComplete="email"
            />
            <TextField
              label="Phone"
              type="tel"
              placeholder="07XX XXX XXX"
              value={details.phone}
              onChange={updateDetail("phone")}
              error={errors.phone}
              autoComplete="tel"
            />
            <details className="group mt-5 text-sub">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs">
                <ChevronDown
                  aria-hidden
                  className="size-4 transition-transform group-open:rotate-180"
                />
                Add optional business details
              </summary>
              <TextField
                label="Address"
                value={details.address}
                onChange={updateDetail("address")}
                error={errors.address}
                autoComplete="street-address"
              />
              <TextField
                label="KRA PIN"
                value={details.kraPin}
                onChange={updateDetail("kraPin")}
                error={errors.kraPin}
              />
            </details>
            <dl className="mt-5.5 flex gap-5 border-t border-line pt-4.25 text-sm">
              <div>
                <dt className="text-xs text-sub">Default currency</dt>
                <dd>KES</dd>
              </div>
              <div>
                <dt className="text-xs text-sub">Payment terms</dt>
                <dd>14 days</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-sub">You can change these per invoice.</p>
            <FormMessage>{errors.form}</FormMessage>
            <div className="mt-6.5 flex justify-end">
              <Button type="submit" pending={pending}>
                Continue
              </Button>
            </div>
          </form>
        </StepPanel>
      </>
    );
  }

  if (step === "payment") {
    const numberLabel =
      method === "mpesa_personal"
        ? "M-Pesa number"
        : method === "mpesa_till"
          ? "Till number"
          : "Paybill number";
    return (
      <>
        <Stepper current={3} />
        <StepPanel
          title="Tell clients how to pay you."
          description="These instructions appear on your invoices. Clients pay you outside BillSafi."
        >
          <form method="post" onSubmit={savePayment} noValidate>
            <SelectField
              label="Payment method"
              value={method}
              onChange={(event) => changeMethod(event.target.value as PaymentMethod)}
            >
              {paymentMethods.map((value) => (
                <option key={value} value={value}>
                  {paymentMethodLabels[value]}
                </option>
              ))}
            </SelectField>
            {method !== "bank_transfer" && (
              <TextField
                label={numberLabel}
                inputMode="numeric"
                placeholder={method === "mpesa_personal" ? "07XX XXX XXX" : "Business number"}
                value={accountNumber}
                onChange={(event) => {
                  setNumberEdited(true);
                  setAccountNumber(event.target.value);
                }}
                error={errors.accountNumber}
              />
            )}
            <TextAreaField
              label={method === "bank_transfer" ? "Bank transfer details" : "Payment instructions"}
              placeholder={
                method === "bank_transfer"
                  ? "Bank, account name, account number and branch"
                  : "Optional, for example the account name to use"
              }
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              error={errors.instructions}
            />
            <p className="mt-2 text-xs text-sub">You can finish this later in business settings.</p>
            <FormMessage>{errors.form}</FormMessage>
            <div className="mt-6.5 flex flex-wrap items-center justify-between gap-2.5">
              <Button type="button" variant="ghost" onClick={() => setStep("business")}>
                <ArrowLeft aria-hidden className="size-4" />
                Back
              </Button>
              <div className="flex flex-wrap gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep("done")}>
                  Skip for now
                </Button>
                <Button type="submit" pending={pending}>
                  Finish setup
                </Button>
              </div>
            </div>
          </form>
        </StepPanel>
      </>
    );
  }

  return (
    <>
      <Stepper current={4} />
      <StepPanel
        title="You're ready to invoice."
        description={`${business!.displayName} is set up.`}
      >
        <div className="mt-5 rounded-panel border border-line bg-soft p-4">
          <p className="text-sm font-medium">Free plan</p>
          <p className="mt-1 text-sm text-sub">{FREE_PLAN.invoiceLimit} invoices per month</p>
          <p className="mt-1 text-xs text-sub">Allowance shared across your businesses.</p>
        </div>
        <Button type="button" onClick={enterApp} className="mt-6 w-full">
          Go to your overview
        </Button>
      </StepPanel>
    </>
  );
}
