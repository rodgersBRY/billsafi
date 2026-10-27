CREATE TABLE "backup_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"size_bytes" bigint,
	"file_name" text,
	"error" text,
	CONSTRAINT "backup_runs_status" CHECK ("backup_runs"."status" in ('succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "failed_sign_ins" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text,
	"method" text NOT NULL,
	"reason" text NOT NULL,
	"ip_masked" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "failed_sign_ins_method" CHECK ("failed_sign_ins"."method" in ('password', 'google')),
	CONSTRAINT "failed_sign_ins_reason" CHECK ("failed_sign_ins"."reason" in ('wrong_password', 'unknown_email', 'banned', 'registration_closed', 'other')),
	CONSTRAINT "failed_sign_ins_email_length" CHECK (char_length("failed_sign_ins"."email") <= 320)
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"error_class" text,
	CONSTRAINT "job_runs_status" CHECK ("job_runs"."status" in ('succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "operation_failures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" text NOT NULL,
	"operation" text NOT NULL,
	"account_id" uuid,
	"error_class" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_failures_kind" CHECK ("operation_failures"."kind" in ('pdf', 'email', 'job')),
	CONSTRAINT "operation_failures_message_length" CHECK (char_length("operation_failures"."message") <= 300)
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"account_id" uuid,
	"anonymous_id" uuid,
	"invoice_id" uuid,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_events_name" CHECK ("product_events"."name" in ('pdf_downloaded', 'link_opened', 'generator_started', 'generator_download_clicked', 'generator_signup_clicked', 'guest_invoice_imported')),
	CONSTRAINT "product_events_props_size" CHECK (pg_column_size("product_events"."props") <= 1100)
);
--> statement-breakpoint
CREATE INDEX "backup_runs_finished_idx" ON "backup_runs" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "failed_sign_ins_created_idx" ON "failed_sign_ins" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "failed_sign_ins_email_created_idx" ON "failed_sign_ins" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "job_runs_job_finished_idx" ON "job_runs" USING btree ("job","finished_at");--> statement-breakpoint
CREATE INDEX "operation_failures_created_idx" ON "operation_failures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operation_failures_kind_created_idx" ON "operation_failures" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "operation_failures_account_created_idx" ON "operation_failures" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "product_events_name_created_idx" ON "product_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "product_events_account_created_idx" ON "product_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_events_dedupe_key_idx" ON "product_events" USING btree ("dedupe_key") WHERE "product_events"."dedupe_key" is not null;