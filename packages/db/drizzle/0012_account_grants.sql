CREATE TYPE "public"."account_grant_kind" AS ENUM('pro_months', 'invoice_credits');--> statement-breakpoint
ALTER TYPE "public"."subscription_event_kind" ADD VALUE 'granted';--> statement-breakpoint
CREATE TABLE "account_grants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "account_grant_kind" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_from" timestamp with time zone,
	"granted_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_grants_quantity" CHECK (("account_grants"."kind" = 'pro_months' and "account_grants"."quantity" between 1 and 12
        and "account_grants"."granted_from" is not null and "account_grants"."granted_until" is not null)
      or ("account_grants"."kind" = 'invoice_credits' and "account_grants"."quantity" between 1 and 500))
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
ALTER TABLE "account_grants" ADD CONSTRAINT "account_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_grants" ADD CONSTRAINT "account_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_grants_user_created_idx" ON "account_grants" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_grant_id_account_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."account_grants"("id") ON DELETE restrict ON UPDATE no action;