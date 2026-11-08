CREATE TABLE "saved_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"business_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_items_quantity_positive" CHECK ("saved_items"."quantity" > 0),
	CONSTRAINT "saved_items_unit_price_non_negative" CHECK ("saved_items"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "saved_item_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "saved_item_id" uuid;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_business_description_active_unique" ON "saved_items" USING btree ("business_id",lower("description")) WHERE "saved_items"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "saved_items_business_use_idx" ON "saved_items" USING btree ("business_id","use_count");--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE set null ON UPDATE no action;