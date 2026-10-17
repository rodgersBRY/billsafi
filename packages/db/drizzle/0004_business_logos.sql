CREATE TABLE "business_logos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_logos_type" CHECK ("business_logos"."content_type" in ('image/png', 'image/jpeg')),
	CONSTRAINT "business_logos_size" CHECK (octet_length("business_logos"."data") <= 524288)
);
--> statement-breakpoint
ALTER TABLE "business_logos" ADD CONSTRAINT "business_logos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_logos_business_id_idx" ON "business_logos" USING btree ("business_id");