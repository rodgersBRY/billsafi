CREATE TYPE "public"."payment_change_kind" AS ENUM('correction', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."received_payment_method" AS ENUM('mpesa', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TABLE "invoice_links" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invoice_links_window" CHECK ("invoice_links"."expires_at" > "invoice_links"."created_at")
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" "received_payment_method" NOT NULL,
	"payment_date" date NOT NULL,
	"reference" text,
	"recorded_by_user_id" uuid NOT NULL,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_id_business_id_unique" UNIQUE("id","business_id"),
	CONSTRAINT "invoice_payments_amount_positive" CHECK ("invoice_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_changes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" "payment_change_kind" NOT NULL,
	"previous_values" jsonb NOT NULL,
	"new_values" jsonb,
	"reason" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_changes_reason_present" CHECK (length(trim("payment_changes"."reason")) > 0),
	CONSTRAINT "payment_changes_new_values_shape" CHECK (("payment_changes"."kind" = 'correction') = ("payment_changes"."new_values" is not null))
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_links" ADD CONSTRAINT "invoice_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_links" ADD CONSTRAINT "invoice_links_invoice_same_business_fk" FOREIGN KEY ("invoice_id","business_id") REFERENCES "public"."invoices"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_same_business_fk" FOREIGN KEY ("invoice_id","business_id") REFERENCES "public"."invoices"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_changes" ADD CONSTRAINT "payment_changes_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_changes" ADD CONSTRAINT "payment_changes_payment_same_business_fk" FOREIGN KEY ("payment_id","business_id") REFERENCES "public"."invoice_payments"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_links_invoice_idx" ON "invoice_links" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_business_date_idx" ON "invoice_payments" USING btree ("business_id","payment_date");--> statement-breakpoint
CREATE INDEX "payment_changes_payment_idx" ON "payment_changes" USING btree ("payment_id");