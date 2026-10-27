ALTER TABLE "subscriptions" ADD COLUMN "paid_until" timestamp with time zone;--> statement-breakpoint
-- addNairobiMonths(anchor_at, paid_months) in SQL, the form the admin e2e suite checks against
-- the domain function (account-sql.ts proEndsAtSql): add months to the Nairobi wall-clock time,
-- where Postgres clamps a missing day to the month's last day.
UPDATE "subscriptions"
SET "paid_until" = (("anchor_at" AT TIME ZONE 'Africa/Nairobi') + make_interval(months => "paid_months"))
  AT TIME ZONE 'Africa/Nairobi'
WHERE "anchor_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_paid_until" CHECK (("subscriptions"."anchor_at" is null) = ("subscriptions"."paid_until" is null));
