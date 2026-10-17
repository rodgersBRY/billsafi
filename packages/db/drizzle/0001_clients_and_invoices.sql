CREATE TYPE "public"."discount_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'ready', 'partially_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"company_name" text,
	"address" text,
	"kra_pin" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_id_business_id_unique" UNIQUE("id","business_id"),
	CONSTRAINT "clients_phone_format" CHECK ("clients"."phone" ~ '^\+254[17][0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "invoice_issuances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"usage_period_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_issuances_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "invoice_items_invoice_position_unique" UNIQUE("invoice_id","position"),
	CONSTRAINT "invoice_items_quantity_positive" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_unit_price_non_negative" CHECK ("invoice_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"sequence_number" integer,
	"invoice_number" text,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"currency" char(3) DEFAULT 'KES' NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(14, 2),
	"tax_rate" numeric(5, 2),
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_instructions" text,
	"notes" text,
	"client_snapshot" jsonb,
	"business_snapshot" jsonb,
	"ready_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_id_business_id_unique" UNIQUE("id","business_id"),
	CONSTRAINT "invoices_business_sequence_unique" UNIQUE("business_id","sequence_number"),
	CONSTRAINT "invoices_business_number_unique" UNIQUE("business_id","invoice_number"),
	CONSTRAINT "invoices_due_after_issue" CHECK ("invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "invoices_discount_pair" CHECK (("invoices"."discount_type" is null) = ("invoices"."discount_value" is null)),
	CONSTRAINT "invoices_number_once_ready" CHECK (("invoices"."status" = 'draft') = ("invoices"."sequence_number" is null)
        and ("invoices"."sequence_number" is null) = ("invoices"."invoice_number" is null)),
	CONSTRAINT "invoices_tax_rate_range" CHECK ("invoices"."tax_rate" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "usage_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"invoice_limit" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_periods_user_plan_start_unique" UNIQUE("user_id","plan_code","starts_at"),
	CONSTRAINT "usage_periods_window" CHECK ("usage_periods"."ends_at" > "usage_periods"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_issuances" ADD CONSTRAINT "invoice_issuances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_issuances" ADD CONSTRAINT "invoice_issuances_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_issuances" ADD CONSTRAINT "invoice_issuances_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_issuances" ADD CONSTRAINT "invoice_issuances_usage_period_id_usage_periods_id_fk" FOREIGN KEY ("usage_period_id") REFERENCES "public"."usage_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_same_business_fk" FOREIGN KEY ("invoice_id","business_id") REFERENCES "public"."invoices"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_same_business_fk" FOREIGN KEY ("client_id","business_id") REFERENCES "public"."clients"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_business_id_name_idx" ON "clients" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "invoice_issuances_user_issued_at_idx" ON "invoice_issuances" USING btree ("user_id","issued_at");--> statement-breakpoint
CREATE INDEX "invoices_business_status_due_idx" ON "invoices" USING btree ("business_id","status","due_date");--> statement-breakpoint
CREATE INDEX "invoices_business_client_idx" ON "invoices" USING btree ("business_id","client_id");