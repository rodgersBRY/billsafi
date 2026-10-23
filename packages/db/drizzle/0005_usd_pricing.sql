ALTER TABLE "subscription_payments" ADD COLUMN "price_usd" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "usd_kes_rate" numeric(14, 6);