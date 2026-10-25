import { CREDIT_PACK, FREE_PLAN, PRO_PLAN } from "@billsafi/domain";
import { formatCount, formatUsd } from "../admin-format";

const plans = [
  {
    name: "Free",
    price: "No charge",
    detail: `${formatCount(FREE_PLAN.invoiceLimit)} invoices a month across all businesses.`,
  },
  {
    name: "Pro",
    price: `${formatUsd(PRO_PLAN.priceUsd)} a month`,
    detail: `${formatCount(PRO_PLAN.invoiceLimit)} invoices a month. Charged in KES through M-Pesa.`,
  },
  {
    name: "Credit pack",
    price: formatUsd(CREDIT_PACK.priceUsd),
    detail: `${formatCount(CREDIT_PACK.invoices)} extra invoices, used after the plan allowance. They don't expire.`,
  },
];

/** The plans as they are set in code. Read only: changing them is a code change. */
export function PlanReference() {
  return (
    <section aria-labelledby="plans-title" className="rounded-panel border border-line bg-panel">
      <div className="px-4 pt-4">
        <h2 id="plans-title" className="text-base font-semibold">
          Plans
        </h2>
        <p className="mt-1 text-sm text-sub">
          Read only. Prices and limits are set in code, so changing them takes a release.
        </p>
      </div>
      <ul className="mt-3 grid gap-px border-t border-line bg-line sm:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.name} className="bg-panel p-4">
            <p className="text-sm font-medium">{plan.name}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{plan.price}</p>
            <p className="mt-1 text-xs text-sub">{plan.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
