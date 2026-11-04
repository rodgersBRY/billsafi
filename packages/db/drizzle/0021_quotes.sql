CREATE TYPE "public"."quote_decision" AS ENUM('accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'withdrawn', 'converted');--> statement-breakpoint
CREATE TABLE "quote_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"decision" "quote_decision" NOT NULL,
	"signer_name" text,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"verification_method" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_acceptances_signer_on_accept" CHECK (("quote_acceptances"."decision" = 'accepted') = ("quote_acceptances"."signer_name" is not null))
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "quote_items_quote_position_unique" UNIQUE("quote_id","position"),
	CONSTRAINT "quote_items_quantity_positive" CHECK ("quote_items"."quantity" > 0),
	CONSTRAINT "quote_items_unit_price_non_negative" CHECK ("quote_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_quote_version_unique" UNIQUE("quote_id","version"),
	CONSTRAINT "quote_versions_positive" CHECK ("quote_versions"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"sequence_number" integer,
	"quote_number" text,
	"system_quote_number" text,
	"reserved_quote_numbers" text[] DEFAULT '{}'::text[] NOT NULL,
	"issue_date" date NOT NULL,
	"valid_until" date NOT NULL,
	"currency" char(3) DEFAULT 'KES' NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(14, 2),
	"tax_rate" numeric(5, 2),
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"client_snapshot" jsonb,
	"business_snapshot" jsonb,
	"current_version" integer,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"withdrawn_at" timestamp with time zone,
	"converted_invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_converted_invoice_id_unique" UNIQUE("converted_invoice_id"),
	CONSTRAINT "quotes_id_business_id_unique" UNIQUE("id","business_id"),
	CONSTRAINT "quotes_business_sequence_unique" UNIQUE("business_id","sequence_number"),
	CONSTRAINT "quotes_business_number_unique" UNIQUE("business_id","quote_number"),
	CONSTRAINT "quotes_valid_after_issue" CHECK ("quotes"."valid_until" >= "quotes"."issue_date"),
	CONSTRAINT "quotes_discount_pair" CHECK (("quotes"."discount_type" is null) = ("quotes"."discount_value" is null)),
	CONSTRAINT "quotes_number_once_sent" CHECK (("quotes"."status" = 'draft') = ("quotes"."sequence_number" is null)
        and ("quotes"."status" = 'draft' or "quotes"."quote_number" is not null)),
	CONSTRAINT "quotes_tax_rate_range" CHECK ("quotes"."tax_rate" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "next_quote_sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quote_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_same_business_fk" FOREIGN KEY ("quote_id","business_id") REFERENCES "public"."quotes"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_same_business_fk" FOREIGN KEY ("quote_id","business_id") REFERENCES "public"."quotes"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_links" ADD CONSTRAINT "quote_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_links" ADD CONSTRAINT "quote_links_quote_same_business_fk" FOREIGN KEY ("quote_id","business_id") REFERENCES "public"."quotes"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_same_business_fk" FOREIGN KEY ("quote_id","business_id") REFERENCES "public"."quotes"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_invoice_id_invoices_id_fk" FOREIGN KEY ("converted_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_same_business_fk" FOREIGN KEY ("client_id","business_id") REFERENCES "public"."clients"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_acceptances_quote_idx" ON "quote_acceptances" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_links_quote_idx" ON "quote_links" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_business_status_valid_idx" ON "quotes" USING btree ("business_id","status","valid_until");--> statement-breakpoint
CREATE INDEX "quotes_business_client_idx" ON "quotes" USING btree ("business_id","client_id");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_next_quote_sequence_positive" CHECK ("businesses"."next_quote_sequence" >= 1);