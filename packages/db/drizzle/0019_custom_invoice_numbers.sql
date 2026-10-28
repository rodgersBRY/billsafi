ALTER TABLE "invoices" DROP CONSTRAINT "invoices_number_once_ready";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "system_invoice_number" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "reserved_invoice_numbers" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_number_once_ready" CHECK (("invoices"."status" = 'draft') = ("invoices"."sequence_number" is null)
        and ("invoices"."status" = 'draft' or "invoices"."invoice_number" is not null));
--> statement-breakpoint
-- Stop for manual resolution rather than silently renumber existing invoices.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM invoices WHERE invoice_number IS NOT NULL
    GROUP BY business_id, lower(invoice_number) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Resolve case-insensitive duplicate invoice numbers before migrating';
  END IF;
END $$;
--> statement-breakpoint
UPDATE invoices SET system_invoice_number = invoice_number,
  reserved_invoice_numbers = ARRAY[invoice_number]
WHERE status <> 'draft';
