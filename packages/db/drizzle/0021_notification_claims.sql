ALTER TYPE "public"."subscription_reminder_kind" ADD VALUE 'after_expiry';--> statement-breakpoint
ALTER TABLE "usage_periods" ADD COLUMN "limit_emailed_at" timestamp with time zone;