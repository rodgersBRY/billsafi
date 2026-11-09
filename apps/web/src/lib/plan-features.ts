import { CREDIT_PACK, FREE_PLAN, PRO_PLAN } from "@billsafi/domain";

/** What Free includes, shown on the landing page and billing page. */
export const FREE_FEATURES = [
  `${FREE_PLAN.invoiceLimit} invoices a month`,
  "Quotes your clients accept online",
  "PDF, link, WhatsApp and email sharing",
  "Saved clients and payment tracking",
  `Up to ${FREE_PLAN.savedItemLimit} saved line items`,
  `${FREE_PLAN.businessLimit} business`,
];

/** What Pro adds on top of Free. */
export const PRO_FEATURES = [
  `${PRO_PLAN.invoiceLimit} invoices a month`,
  "Everything in Free",
  "Recurring invoices on a schedule",
  "Unlimited saved line items",
  "Unlimited businesses, one plan",
  "No automatic charges",
];

/** One row of the plan comparison. `true` shows a check, `false` a dash. */
export interface PlanFeatureRow {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
}

export const PLAN_COMPARISON: PlanFeatureRow[] = [
  {
    feature: "Invoices a month",
    free: String(FREE_PLAN.invoiceLimit),
    pro: String(PRO_PLAN.invoiceLimit),
  },
  { feature: "Quotes, with online accept or decline", free: true, pro: true },
  { feature: "PDF, link, WhatsApp and email sharing", free: true, pro: true },
  { feature: "Clients, payments and partial payments", free: true, pro: true },
  {
    feature: "Saved line items",
    free: `Up to ${FREE_PLAN.savedItemLimit}`,
    pro: "Unlimited",
  },
  { feature: "Recurring invoices", free: false, pro: true },
  { feature: "Businesses", free: String(FREE_PLAN.businessLimit), pro: "Unlimited" },
  { feature: `Extra invoices, ${CREDIT_PACK.invoices} per pack`, free: true, pro: true },
];
