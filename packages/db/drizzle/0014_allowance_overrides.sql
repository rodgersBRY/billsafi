CREATE TABLE "allowance_overrides" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"extra_invoices" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	CONSTRAINT "allowance_overrides_extra" CHECK ("allowance_overrides"."extra_invoices" between 1 and 1000),
	CONSTRAINT "allowance_overrides_window" CHECK ("allowance_overrides"."expires_at" > "allowance_overrides"."starts_at"),
	CONSTRAINT "allowance_overrides_revoked" CHECK (("allowance_overrides"."revoked_at" is null) = ("allowance_overrides"."revoked_by" is null))
);
--> statement-breakpoint
ALTER TABLE "allowance_overrides" ADD CONSTRAINT "allowance_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_overrides" ADD CONSTRAINT "allowance_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_overrides" ADD CONSTRAINT "allowance_overrides_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allowance_overrides_user_idx" ON "allowance_overrides" USING btree ("user_id","expires_at");