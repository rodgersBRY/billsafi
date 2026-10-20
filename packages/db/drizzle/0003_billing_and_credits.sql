CREATE TYPE "public"."subscription_reminder_kind" AS ENUM('before_expiry', 'on_expiry');--> statement-breakpoint
CREATE TYPE "public"."subscription_event_kind" AS ENUM('activated', 'renewed', 'credits_added', 'cancelled', 'cancellation_undone');--> statement-breakpoint
CREATE TYPE "public"."subscription_payment_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_purpose" AS ENUM('pro_month', 'invoice_credits');--> statement-breakpoint
CREATE TYPE "public"."issuance_source" AS ENUM('plan', 'credit');--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"kind" "subscription_event_kind" NOT NULL,
	"payment_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "subscription_purpose" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"phone" text NOT NULL,
	"status" "subscription_payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"merchant_request_id" text,
	"checkout_request_id" text,
	"receipt" text,
	"result_code" text,
	"result_description" text,
	"confirmed_at" timestamp with time zone,
	"granted_from" timestamp with time zone,
	"granted_until" timestamp with time zone,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_checkout_request_id_unique" UNIQUE("checkout_request_id"),
	CONSTRAINT "subscription_payments_receipt_unique" UNIQUE("receipt"),
	CONSTRAINT "subscription_payments_amount" CHECK ("subscription_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "subscription_reminders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"kind" "subscription_reminder_kind" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_reminders_once" UNIQUE("subscription_id","kind","expires_at")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"anchor_at" timestamp with time zone,
	"paid_months" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_paid_months" CHECK ("subscriptions"."paid_months" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_issuances" ADD COLUMN "source" "issuance_source" DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "carried_over" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_payment_id_subscription_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."subscription_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reminders" ADD CONSTRAINT "subscription_reminders_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_events_subscription_idx" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_user_created_idx" ON "subscription_payments" USING btree ("user_id","created_at");