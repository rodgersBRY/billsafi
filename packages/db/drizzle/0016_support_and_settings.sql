CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"severity" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	CONSTRAINT "support_cases_id_account_key" UNIQUE("id","account_id"),
	CONSTRAINT "support_cases_category" CHECK ("support_cases"."category" in ('billing', 'sign_in', 'invoices', 'payments', 'bug', 'other')),
	CONSTRAINT "support_cases_severity" CHECK ("support_cases"."severity" in ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "support_cases_status" CHECK ("support_cases"."status" in ('open', 'waiting', 'resolved')),
	CONSTRAINT "support_cases_resolved_fields" CHECK (("support_cases"."status" = 'resolved') = ("support_cases"."resolved_at" is not null and "support_cases"."resolution" is not null)
        and ("support_cases"."status" = 'resolved' or ("support_cases"."resolved_at" is null and "support_cases"."resolution" is null)))
);
--> statement-breakpoint
CREATE TABLE "support_notes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"case_id" uuid,
	"account_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_notes" ADD CONSTRAINT "support_notes_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_notes" ADD CONSTRAINT "support_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_notes" ADD CONSTRAINT "support_notes_case_account_fk" FOREIGN KEY ("case_id","account_id") REFERENCES "public"."support_cases"("id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_cases_account_idx" ON "support_cases" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "support_cases_status_updated_idx" ON "support_cases" USING btree ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "support_notes_case_idx" ON "support_notes" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "support_notes_account_idx" ON "support_notes" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
-- Notes are append-only: a mistaken note is answered with a new one, never edited (D065).
CREATE FUNCTION "support_notes_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'support_notes is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "support_notes_no_update_or_delete" BEFORE UPDATE OR DELETE ON "support_notes"
  FOR EACH ROW EXECUTE FUNCTION "support_notes_append_only"();--> statement-breakpoint
CREATE TRIGGER "support_notes_no_truncate" BEFORE TRUNCATE ON "support_notes"
  FOR EACH STATEMENT EXECUTE FUNCTION "support_notes_append_only"();
