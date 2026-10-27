CREATE TABLE "admin_idempotency_keys" (
	"admin_user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"action" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_idempotency_keys_admin_user_id_key_pk" PRIMARY KEY("admin_user_id","key")
);
--> statement-breakpoint
ALTER TABLE "subscription_payments" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "recorded_by" uuid;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "admin_idempotency_keys" ADD CONSTRAINT "admin_idempotency_keys_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payments_manual_reference" ON "subscription_payments" USING btree ("provider","method",upper("external_reference")) WHERE "subscription_payments"."provider" = 'manual';--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_quantity" CHECK ("subscription_payments"."quantity" between 1 and 12);--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_currency" CHECK ("subscription_payments"."currency" in ('KES', 'USD'));--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_method" CHECK ("subscription_payments"."method" is null or "subscription_payments"."method" in ('mpesa_direct', 'bank_transfer', 'cash', 'other'));--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_phone" CHECK ("subscription_payments"."provider" = 'manual' or "subscription_payments"."phone" is not null);--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_manual" CHECK ("subscription_payments"."provider" <> 'manual' or ("subscription_payments"."status" = 'succeeded'
        and "subscription_payments"."method" is not null and "subscription_payments"."external_reference" is not null
        and "subscription_payments"."paid_at" is not null and "subscription_payments"."recorded_by" is not null));