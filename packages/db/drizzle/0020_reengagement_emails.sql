CREATE TABLE "email_opt_outs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reengagement_emails" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"segment" text NOT NULL,
	"step" integer NOT NULL,
	"quiet_since" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reengagement_emails_spell_step_unique" UNIQUE("user_id","quiet_since","step"),
	CONSTRAINT "reengagement_emails_segment" CHECK ("reengagement_emails"."segment" in ('no_business', 'no_invoice', 'lapsed')),
	CONSTRAINT "reengagement_emails_step" CHECK ("reengagement_emails"."step" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "email_opt_outs" ADD CONSTRAINT "email_opt_outs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reengagement_emails" ADD CONSTRAINT "reengagement_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reengagement_emails_sent_idx" ON "reengagement_emails" USING btree ("sent_at");