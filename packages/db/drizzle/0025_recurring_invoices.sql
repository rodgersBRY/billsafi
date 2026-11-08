CREATE TYPE "public"."recurring_mode" AS ENUM('draft', 'ready');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_pause_reason" AS ENUM('user', 'pro_ended', 'client_archived');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "recurring_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"recurring_invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"saved_item_id" uuid,
	CONSTRAINT "recurring_invoice_items_position_unique" UNIQUE("recurring_invoice_id","position"),
	CONSTRAINT "recurring_invoice_items_quantity_positive" CHECK ("recurring_invoice_items"."quantity" > 0),
	CONSTRAINT "recurring_invoice_items_unit_price_non_negative" CHECK ("recurring_invoice_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"paused_reason" "recurring_pause_reason",
	"frequency" "recurring_frequency" NOT NULL,
	"mode" "recurring_mode" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"max_count" integer,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"next_index" integer DEFAULT 0 NOT NULL,
	"next_run_date" date,
	"payment_terms_days" integer NOT NULL,
	"currency" char(3) DEFAULT 'KES' NOT NULL,
	"discount_type" text,
	"discount_value" numeric(14, 2),
	"tax_rate" numeric(5, 2),
	"payment_instructions" text,
	"notes" text,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_invoices_id_business_id_unique" UNIQUE("id","business_id"),
	CONSTRAINT "recurring_invoices_end_after_start" CHECK ("recurring_invoices"."end_date" is null or "recurring_invoices"."end_date" >= "recurring_invoices"."start_date"),
	CONSTRAINT "recurring_invoices_one_end" CHECK ("recurring_invoices"."end_date" is null or "recurring_invoices"."max_count" is null),
	CONSTRAINT "recurring_invoices_max_count_positive" CHECK ("recurring_invoices"."max_count" is null or "recurring_invoices"."max_count" > 0),
	CONSTRAINT "recurring_invoices_terms_range" CHECK ("recurring_invoices"."payment_terms_days" between 0 and 365),
	CONSTRAINT "recurring_invoices_discount_pair" CHECK (("recurring_invoices"."discount_type" is null) = ("recurring_invoices"."discount_value" is null)),
	CONSTRAINT "recurring_invoices_discount_type" CHECK ("recurring_invoices"."discount_type" is null or "recurring_invoices"."discount_type" in ('fixed', 'percentage')),
	CONSTRAINT "recurring_invoices_paused_reason" CHECK (("recurring_invoices"."status" = 'paused') = ("recurring_invoices"."paused_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "default_recurring_mode" "recurring_mode" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recurring_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "period_date" date;--> statement-breakpoint
ALTER TABLE "recurring_invoice_items" ADD CONSTRAINT "recurring_invoice_items_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_items" ADD CONSTRAINT "recurring_invoice_items_schedule_same_business_fk" FOREIGN KEY ("recurring_invoice_id","business_id") REFERENCES "public"."recurring_invoices"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_client_same_business_fk" FOREIGN KEY ("client_id","business_id") REFERENCES "public"."clients"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_invoices_business_idx" ON "recurring_invoices" USING btree ("business_id","updated_at");--> statement-breakpoint
CREATE INDEX "recurring_invoices_due_idx" ON "recurring_invoices" USING btree ("next_run_date") WHERE "recurring_invoices"."status" <> 'ended';--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_invoice_id_recurring_invoices_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_period_unique" UNIQUE("recurring_invoice_id","period_date");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_period_pair" CHECK (("invoices"."recurring_invoice_id" is null) or ("invoices"."period_date" is not null));