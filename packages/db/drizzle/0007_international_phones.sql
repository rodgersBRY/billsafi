ALTER TABLE "businesses" DROP CONSTRAINT "businesses_phone_format";--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_phone_format";--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_phone_format" CHECK ("businesses"."phone" ~ '^\+[1-9][0-9]{7,14}$');--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_phone_format" CHECK ("clients"."phone" ~ '^\+[1-9][0-9]{7,14}$');