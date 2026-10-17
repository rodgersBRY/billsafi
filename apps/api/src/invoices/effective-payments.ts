import { schema, sql } from "@tallynest/db";

const { invoices } = schema;

/** Sum of a invoice's payments that have not been reversed (D043). */
export const effectivePaymentsSql = sql<string>`coalesce((
  select sum(p.amount) from invoice_payments p
  where p.invoice_id = ${invoices.id} and p.reversed_at is null
), 0)::numeric(14,2)::text`;
