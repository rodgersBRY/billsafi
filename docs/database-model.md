# TallyNest database specification

Last updated: 2026-10-15
Status: conceptual model adopted; migration-level details remain open.
Source: continuation chat; user adopted the refined database model, decimal arithmetic, rounding, and retention rules.

## Architecture and ownership

Use one PostgreSQL database with shared application tables. Accounts are authenticated users managed by Better Auth. A business is a tenant owned by `owner_user_id`; V1 has no team memberships. Every business-owned record carries `business_id`. Subscriptions and usage allowances belong to the account across its businesses.

Enforce cross-business consistency with composite relationships where appropriate: an invoice's client must belong to its business, and items/payments/links must belong to their invoice's business. Backend authorization must check account ownership on every business operation. Shared tables alone do not enforce authorization.

Use internal identifiers separately from public invoice numbers. Exact identifier types, ORM, auth adapter/schema, nullability details, and indexing beyond the constraints below must be finalized before migrations.

## Table inventory

Twelve application tables are adopted. Better Auth adds its required authentication tables; the expected total is approximately sixteen without optional plugins. Use the installed Better Auth version's supported schema rather than independently defining its credentials/session/token tables.

| Table                         | Purpose and principal fields                                                                                                                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| businesses                    | `id`, `owner_user_id`, `profile_type`, `display_name`, `contact_email`, required `phone`, optional `address`/`kra_pin`/`logo_key`, `default_currency`, `default_payment_terms_days`, `next_invoice_sequence`, timestamps                                                                       |
| business_payment_instructions | `id`, `business_id`, method type, method-specific details, optional instruction text, timestamps; exact fields and multiplicity policy remain open                                                                                                                                             |
| clients                       | `id`, `business_id`, required `name`/`phone`, optional `email`/`company_name`/`address`/`kra_pin`, nullable `archived_at`, timestamps                                                                                                                                                          |
| invoices                      | `id`, `business_id`, `client_id`, nullable permanent `invoice_number`/`sequence_number`, `status`, `issue_date`, `due_date`, `ready_at`, `cancelled_at`, currency, discount type/value, tax rate, calculated subtotal/discount/tax/total, notes, business/client/payment snapshots, timestamps |
| invoice_items                 | `id`, `business_id`, `invoice_id`, `position`, description, quantity, unit price, calculated line total                                                                                                                                                                                        |
| invoice_payments              | `id`, `business_id`, `invoice_id`, amount, method, payment date, optional reference, `recorded_by_user_id`, timestamps                                                                                                                                                                         |
| payment_changes               | `id`, `business_id`, payment reference, previous/new values, required reason, actor, timestamp; detailed correction/reversal representation remains open                                                                                                                                       |
| invoice_links                 | `id`, `business_id`, `invoice_id`, unique token hash, created/revoked timestamps                                                                                                                                                                                                               |
| subscriptions                 | `id`, `user_id`, plan, entitlement status, current period start/end, timestamps; current account entitlement separate from payment history                                                                                                                                                     |
| subscription_payments         | `id`, account/purchase reference, expected/confirmed amounts, currency, payment state, provider references, timestamps and granted period details; exact provider fields depend on integration feasibility                                                                                     |
| usage_periods                 | `id`, `user_id`, plan code, start/end, invoice limit; transition/reset rules remain open                                                                                                                                                                                                       |
| invoice_issuances             | `id`, `user_id`, `business_id`, unique `invoice_id`, `usage_period_id`, issuance timestamp                                                                                                                                                                                                     |

## Invoice snapshots

Preserve structured JSON snapshots of client identity, issuing business identity, and payment instructions on each invoice. Frequently searched/calculated properties stay ordinary columns. Define snapshot field formats in application code. Saved profile edits must not silently alter existing invoice details. Explicit invoice edits remain subject to lifecycle rules; snapshot refresh timing/mechanics must be finalized.

Bill to uses client name first, followed by a different optional company name; omit duplicates.

## Decimal calculations — adopted

Use PostgreSQL `numeric` for monetary amounts and fractional quantities, with decimal arithmetic in the backend. Exact precision/scale and accepted input ranges remain open; avoid floating-point arithmetic for money.

1. Multiply quantity by unit price and round each line total to two decimal places.
2. Sum rounded line totals for subtotal.
3. Apply the one optional fixed/percentage subtotal discount; round its calculated monetary amount to two decimal places.
4. Calculate enabled tax on the discounted subtotal and round tax to two decimal places.
5. Invoice total equals subtotal minus discount plus tax.

Use round half up consistently: 10.125 becomes 10.13 for positive invoice amounts. Discounts above subtotal are rejected. Zero/negative input policies beyond existing positive-payment requirements remain to be specified. Discounts and tax remain optional; tax is off by default.

Store calculated line and invoice totals, updated together by backend logic. There is no independent editable amount-paid field: calculate payments received from effective payment records and balance from invoice total minus that sum. Reversed records are excluded from effective totals; corrected values apply with retained change history.

## Lifecycle, numbering, and transactions

Statuses: Draft, Ready, Partially paid, Paid, Cancelled. Overdue is derived from due date and Ready/Partially paid status, not stored as a separate status. Timezone boundary is unresolved.

Drafts have no permanent number. First transition to Ready must atomically check account entitlement/allowance, allocate the business's next immutable INV-0001 sequence, insert the unique invoice issuance, and update invoice status. Enforce uniqueness of `(business_id, invoice_number)` for assigned numbers and of `invoice_issuances.invoice_id`. No yearly reset or number reuse; no gapless guarantee.

Concurrent requests/retries must not exceed allowance or allocate duplicate numbers. Locking/transaction isolation and retry strategy remain implementation choices.

Recording or correcting payment must coordinate payment records, correction history where applicable, and resulting invoice status in one transaction. Reject new payments above outstanding balance. Payment date is separate from recording timestamp; dashboard receipts use payment date.

After payment, client/items/discount/tax are locked and notes remain editable. Cancellation is allowed only when no effective payments remain, including after reversing all recorded payments. Correction/reversal and continued-locking rules are confirmed below.

## Retention — adopted

Allow permanent deletion of unissued Draft invoices only. Their dependent draft items/links, if any, may be removed with the draft; no financial issuance history exists for them. Ready and later financial records are retained; cancellation does not delete them or free allowance. Payments retain change history. Clients are archived rather than removed through normal client management.

Business deletion and account closure require a separate retention policy. Do not configure automatic cascading account/business deletion that removes issued invoices or payment history. Backup/restore and statutory retention requirements have not been finalized.

## Public links and PDF output

Store hashes of random public link tokens, not plaintext tokens. Disable/replace by revocation; replaced tokens stop working. Always check invoice status; Draft/Cancelled invoices are unavailable publicly. Link expiry policy remains open. Public invoice displays current balance; PDFs are generated snapshots using white background/dark text and compact totals, without itemized payment history. Storing every generated PDF is not required by the current model.

## Account billing and usage

Free: 10 invoices/month. Pro: KES 500/month and 100 invoices per subscription month, across all account businesses. First Ready counts once; cancellation does not restore allowance, and unused allowance does not roll over. Maintain issuance records after cancellation.

Platform subscription payments are separate from freelancers' manually recorded invoice payments. Integrated M-Pesa confirmation is desired, but the current personal-number collection preference requires eligibility verification before implementing checkout. No direct STK Push compatibility or manual fallback is assumed.

Detailed Free reset boundaries, upgrade/downgrade usage mapping, Pro-cap treatment, month-end rules, reminders, refund/fee/tax presentation, and provider purchase/event schema remain unresolved. Backend confirmation must prevent transaction reuse and duplicate activation.

## Before migrations

Finalize ORM/auth adapter, ID types, numeric precision/scale, field validation, indexes and foreign-key deletion policies, payment-instruction shape, snapshot refresh behavior, correction/reversal mechanics, and billing-period rules. Required starting query indexes include business/status/due-date invoice lookup, business/client lookup, invoice payment lookup, account issuance/period lookup, and unique public/provider references where applicable. Exact indexes must reflect final queries.

## Confirmed payment corrections and reversals

Adopted on 2026-10-15 by the user's “ok”.

Users may correct a payment's amount, date, method, or reference with a required reason. Retain previous/new values, actor, timestamp, and reason. The corrected amount plus other effective payments must not exceed the invoice total. Recalculate balance/status; Paid may return to Partially paid after a downward correction.

Users may reverse an incorrectly recorded payment (for example, duplicate entry or wrong invoice) with a required reason. Keep the record marked reversed, exclude it from effective payment totals, and retain its history. A wrong-invoice payment is reversed there and recorded separately against the correct invoice. Record reversal does not transfer money or initiate an M-Pesa reversal.

Once any payment has been recorded, invoice financial fields remain locked even after all payments are reversed; notes remain editable. Cancellation is allowed only when no effective payments remain, including after reversing all recorded payments. This refines the previous no-recorded-payments cancellation rule. Cancellation preserves invoice/payment history and does not restore allowance.

A dedicated refund workflow is deferred beyond V1. A real refund must not be represented as correction of an erroneous payment. Exact permissions/error presentation and whether a reversed record can itself be reinstated remain unresolved; no reinstatement behavior is adopted.

## Confirmed billing periods, plan changes, and cancellation

Adopted on 2026-10-15 by the user's “adopt” after reviewing allowance/reset proposals and early-cancellation behavior.

### Free allowance

Free uses calendar months in Africa/Nairobi time. Ten invoices are allowed per month across all account businesses. Reset at the start of each month; unused allowance expires.

### Pro allowance and renewal

Pro uses paid monthly periods anchored to activation: for example, 15 October–15 November, with 100 invoices per period. Early renewal extends paid access but does not unlock the next allowance until its period starts. Use the original anniversary day where possible; otherwise the month's last day, retaining the original anchor for subsequent periods. Exact time-of-day/DST-independent storage conventions must be specified in implementation; use the adopted Africa/Nairobi reporting boundary consistently.

### Upgrade

On Free-to-Pro upgrade, carry invoices already counted in the current Free calendar month into the first paid period: seven counted invoices leave 93 of 100 available. Do not grant 100 additional invoices. Carried usage is an allocation adjustment/reference to prior issuance, not a second issuance of the invoice; preserve first-Ready counting once. Prior issuance history must remain available for calendar-month calculations.

### Expiry/downgrade

On Pro expiry, apply Free's calendar-month cap against all invoices first made Ready in that calendar month, including those issued on Pro. At ten or more, no new Ready invoice until next month or Pro reactivation. Preserve records, viewing/sharing, and payment recording. No rollover or restoration on invoice cancellation.

The detailed usage treatment of returning from expired Pro to Pro mid-month, repeated upgrade/reactivation cycles, and failed/late-confirmed renewal boundaries still requires finalization; do not infer extra allowance from a state change. Current first-paid-period carry-over rule is explicitly adopted for Free-to-Pro upgrades.

### Cancelling Pro early

Cancellation takes effect at the end of all paid access, including prepaid periods. Keep Pro and remaining period allowances until paid expiry; cancellation does not reset/add allowance. Then return to Free under the downgrade rule. Stop renewal reminders while cancelled; display cancelled status and the access-until date. No automatic deductions exist, and cancellation means no continuation after paid access.

Allow undoing cancellation before expiry without paying again. Restore active state/reminders without changing paid dates or allowances; subsequent renewal still requires a new user-approved payment. No automatic prorated refund for unused days in V1. Duplicate-payment/failed-activation refunds and support refund policy remain unresolved. Do not equate plan cancellation with immediate access revocation or payment-record reversal.

### Database implications

Represent paid access expiry separately from current allowance-period boundaries, so early/prepaid renewal does not advance current usage. Preserve the original monthly anniversary anchor. Record cancellation request and undo history without deleting subscription payment records. Store a cancellation/non-continuation state independently of whether paid access is still valid. Usage-period carry-over must reference prior issuance or store a documented adjustment, retaining one unique issuance per invoice. Exact columns and period allocation design remain migration work.

## ORM selection

Confirmed on 2026-10-15: use Drizzle with PostgreSQL and Drizzle Kit for migration generation/application. Earlier ORM-selection open items are resolved. Better Auth uses its compatible Drizzle adapter and generated supported authentication schema; exact versions/relations API must be checked at implementation. Keep monetary numeric values precision-preserving and use decimal arithmetic; library and precision/scale remain open. Explain the model and queries incrementally because the user is learning Drizzle.
