# System architecture

Status: accepted high-level direction; detailed design pending.
Last updated: 2026-10-15
Source and status conventions: [documentation index](README.md).

## Carried-forward architecture direction

The prior discussion summarizes the chosen foundation as:

| Area | Direction |
| --- | --- |
| Application | Multi-tenant modular monolith |
| Frontend | Next.js with TypeScript |
| Backend | NestJS |
| Database | PostgreSQL |
| Client platform | Responsive web application |

Tenants represent freelancers' invoicing businesses. Business information, clients, invoices, and payments must remain isolated between tenants. This is a design requirement, not a claim that isolation is implemented.

## Confirmed account scope

Confirmed on 2026-10-15: one account supports multiple businesses; each business is a tenant with isolated business data. Email verification is skipped for V1. Better Auth is the selected authentication framework, confirmed on 2026-10-15. V1 businesses are managed solely by their account owner; team invitations and staff permissions are deferred. Users create their first business after registration and use a selector to switch businesses or add another. Clients, invoices, payment instructions, numbering, and dashboard totals are separate per business. Detailed ownership design and business lifecycle rules remain unresolved.

## V1 payment boundary

The application stores payment instructions and manually recorded payments. Clients transfer money outside the application. Integrated M-Pesa processing and automatic reconciliation for client invoices are deferred. Platform subscription payments use a separate integrated M-Pesa confirmation flow, confirmed on 2026-10-15.

Earlier gateway-based routing and settlement diagrams are superseded for V1. Provider choice and future client-payment integration design remain open.

## Unresolved architecture decisions

- Tenant resolution and enforcement of owner-only access in V1. Future membership/permissions design, ownership transfer, and business lifecycle rules remain unresolved; team invitations and staff permissions are deferred.
- Better Auth integration and session strategy; password recovery via emailed time-limited reset links is confirmed for V1, while registration email verification is skipped. Reset links expire after one hour and a reset signs out every session; Better Auth runs inside the NestJS API without the organization plugin (D047).
- API contracts, module boundaries, and validation rules. The conceptual database model is adopted in [database-model.md](database-model.md); migration-level details remain open. Client name and phone are required; email, company name, address, and KRA PIN are optional.
- Snapshots are copied when an invoice is first marked Ready and again on edits before payment activity (D048). Storage is adopted: structured JSON snapshots on each invoice, and `archived_at` on clients.
- Input limits are settled in D048. Rounding (half up to two decimals at each line, discount, and tax) and payment correction semantics are adopted; see [database-model.md](database-model.md).
- Transaction and locking strategy for the confirmed editing, cancellation, correction, and reversal rules. Correction history is stored in `payment_changes`, and reversed payments are kept and excluded from effective totals.
- PDF generation library, pagination, and asset storage (logos, generated PDFs). Public link tokens are random and stored as hashes. V1 supports PDF download and account-free public invoice viewing; Draft and Cancelled invoices must be unavailable through public links.
- WhatsApp sharing opens a prepared message with the link; email sharing opens a prepared draft in the user’s email app. Implementation and fallback behavior remain open; direct platform email delivery has not been adopted.
- Email provider and sender configuration for password-reset messages. This does not change invoice email sharing into direct platform delivery.
- Hosting, deployment, monitoring, backups, and recovery requirements.
- Dashboard aggregation implementation: outstanding balances for Ready/Partially paid invoices, overdue balance, and monthly receipts using recorded payment dates; Draft/Cancelled invoices excluded from balance totals. Totals use effective payments only (corrected values apply, reversed records excluded). Reporting timezone and mixed-currency aggregation remain open.
- Calculation implementation must follow PRD rules: quantity × unit price, one optional subtotal discount, tax after discount, round half up to two decimals at each line total, discount, and tax, and rejection of discounts above subtotal or payments above balance. Use PostgreSQL `numeric` and backend decimal arithmetic; the decimal library and precision/scale are not yet chosen.
- Account-level subscription billing and freemium enforcement: one subscription covers all account businesses, with plan allowances shared across them. Free allows 10 invoices/month and Pro allows 100; count each invoice on its first transition to Ready, do not restore usage on cancellation, and do not roll over unused allowance. Other invoice operations do not consume allowance. At the cap, preserve existing invoice access/sharing, payment recording, and client management. Pro is KES 500 per paid monthly period anchored to activation, with user-approved M-Pesa renewals and integrated payment confirmation. Reset, upgrade, and downgrade accounting is confirmed below; mid-month Pro reactivation and repeated plan-change cycles remain open. Usage enforcement must prevent concurrent requests exceeding the cap; implementation remains open.

Better Auth has been selected for authentication, and Drizzle for database access (see [Selected ORM: Drizzle](#selected-orm-drizzle)). M-Pesa is selected for platform subscription collection, with STK Push checkout and backend confirmation. The collection account, production credentials, and detailed integration path are unresolved. No infrastructure provider has been selected.

## Confirmed subscription integration requirements

Maintain pending subscription purchases and platform subscription payment records separately from tenant invoice payments. Match confirmed successful payments to the expected purchase before activation, prevent transaction reuse and duplicate activation, and handle delayed/failed notifications independently of browser state. Specific API verification and reconciliation mechanisms remain to be designed.

Subscriptions renew with user approval, not automatic deductions. Early renewal extends from expiry; late renewal starts at reactivation. Expiry returns the account to Free without removing business records or blocking existing invoice access/sharing and payment recording. Month-end rules and allowance accounting are confirmed below. Reminders, refunds, and M-Pesa account onboarding remain open.

## Current subscription collection constraint

Recorded on 2026-10-15: the user asked to plan around a personal M-Pesa number for now and move on to other decisions. A business collection account is not confirmed. The adopted goal of integrated subscription confirmation remains, but personal-number compatibility and an eligible integration route are unresolved. Do not assume direct Daraja/STK Push support for that number or silently substitute manual activation. Revisit collection eligibility before implementing subscription checkout.

## Confirmed invoice numbering behavior

Each business has an independent fixed `INV-` sequence starting at `INV-00001` (D048), without yearly resets. Drafts have no permanent invoice number. Allocate the permanent number on first transition to Ready alongside allowance consumption; retain it through edits/cancellation and never reuse cancelled numbers. Custom prefixes/starting numbers are deferred. Enforce number uniqueness within each business and consistent behavior under concurrent transitions/retries; allocation implementation remains open.

## Confirmed invoice rendering layout

Use one V1 template for A4 PDF output and mobile-responsive public invoice pages. Content order: business details and optional logo; client/invoice details; line items; totals; compact Invoice total/Payments received/Balance due summary; optional notes/payment instructions. Hide empty optional fields and omit itemized payment history. Visual design is approved in [brand-and-design.md](brand-and-design.md). PDF pagination remains unresolved. PDF/public update behavior is confirmed below.

## Confirmed public invoice links

Confirmed on 2026-10-15 by the user's “yes” in response to the public-link proposal.

Each invoice has a unique, hard-to-guess public link accessible without an account. Show the current invoice status and compact payment summary; newly recorded payments update the public balance. PDFs remain snapshots from generation time, and users can download fresh copies.

Owners can disable or replace a link. Replacement must invalidate the previous link. Draft and Cancelled invoices remain unavailable publicly; Paid invoices may remain accessible as records. Tokens are random and stored only as hashes (see [database-model.md](database-model.md)). Link expiry policy and unavailable-link page design remain unresolved.

## PostgreSQL reconfirmed

Confirmed on 2026-10-15: after comparing MongoDB with PostgreSQL, the user said “okay lets stick with postgres”. Retain PostgreSQL as the database. MongoDB is not adopted.

Superseded: this section originally treated the shared-table model, entities, tenancy constraints, money representation, and ORM as proposals. All of them were later adopted; see [Adopted relational database model](#adopted-relational-database-model) and [Selected ORM: Drizzle](#selected-orm-drizzle). Migration-level details are still open.

## Adopted relational database model

Confirmed on 2026-10-15 by the user's “adopt”: shared PostgreSQL tables with account-owned businesses, business-scoped records, account-level subscriptions/usage, and the proposed twelve application entities. See database-model.md for the adopted model, exact-decimal rounding rules, invoice snapshots, atomic operations, and retention. Migration-level details remain open; this supersedes earlier statements that the shared-table model/table inventory were only proposals.

## Confirmed payment corrections and reversals

Adopted on 2026-10-15 by the user's “ok”.

Users may correct a payment's amount, date, method, or reference with a required reason. Retain previous/new values, actor, timestamp, and reason. The corrected amount plus other effective payments must not exceed the invoice total. Recalculate balance/status; Paid may return to Partially paid after a downward correction.

Users may reverse an incorrectly recorded payment (for example, duplicate entry or wrong invoice) with a required reason. Keep the record marked reversed, exclude it from effective payment totals, and retain its history. A wrong-invoice payment is reversed there and recorded separately against the correct invoice. Record reversal does not transfer money or initiate an M-Pesa reversal.

Once any payment has been recorded, invoice financial fields remain locked even after all payments are reversed; notes remain editable. Cancellation is allowed only when no effective payments remain, including after reversing all recorded payments. This refines the previous no-recorded-payments cancellation rule. Cancellation preserves invoice/payment history and does not restore allowance.

A dedicated refund workflow is deferred beyond V1. A real refund must not be represented as correction of an erroneous payment. Exact permissions/error presentation and whether a reversed record can itself be reinstated remain unresolved; no reinstatement behavior is adopted.

Database implementation must represent reversal explicitly (for example, a nullable reversal timestamp and actor plus retained reason/change event), without deleting payment records. Store irreversible evidence that payment activity occurred, or derive it from retained records, to enforce continued invoice-field locking. Exact columns and transactional update strategy remain implementation details.

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

## Selected ORM: Drizzle

Confirmed on 2026-10-15: the user selected Drizzle despite being new to it, requesting teaching as implementation progresses. Use Drizzle with PostgreSQL and Drizzle Kit for versioned migrations. Use a precision-preserving numeric mapping and backend decimal arithmetic; the specific decimal library and compatible dependency versions remain to be selected. This supersedes earlier ORM-selection open items. Explain schema, relationships, queries, transactions, and migrations through TallyNest examples as they are implemented.
