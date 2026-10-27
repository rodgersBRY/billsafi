ALTER TABLE "account_grants" ADD COLUMN "ended_early_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "ended_early_at" timestamp with time zone;