# User journeys

Last updated: 2026-10-15
Source and status conventions: [documentation index](README.md).

## Confirmed V1 journey: invoice to manual payment

1. The freelancer creates an invoice with client details, services, amounts, and a payment deadline.
2. The invoice includes the freelancer's payment instructions.
3. The freelancer downloads a PDF or shares a public link. WhatsApp opens a prepared message with the link; email opens a prepared draft in the freelancer’s email app. Clients can view the public invoice without an account; Draft and Cancelled invoices are unavailable through public links.
4. The client pays outside the application using those instructions.
5. After receiving payment, the freelancer selects Record Payment and enters the amount, method, date, and optionally a transaction reference.
6. The application updates the outstanding balance. Further payments can be recorded against the same invoice.

Example: invoice total KES 50,000; payment KES 20,000; remaining balance KES 30,000; partially paid.

The application does not confirm receipt through a payment provider in V1. Payment mistakes can be corrected with a reason and change history. Correction mechanics, reversals, overpayments, and remaining invoice status transitions are unresolved.

## Confirmed journey: registration and setup

Confirmed on 2026-10-15 in the continuation chat.

1. Register with full name, email, and password.
2. Choose individual or business invoice identity and provide a display name and contact email.
3. Provide a required phone number; optionally add logo, address, and KRA PIN.
4. Add personal M-Pesa, Till, Paybill, or bank payment instructions, or skip payment setup initially.
5. Start with KES and 14-day payment terms; these defaults can be changed per invoice.

The five-minute target, exact payment-method fields, and detailed invoice calculations remain unresolved. Payment instructions describe off-platform collection; integration remains deferred.

## Confirmed invoice creation details

Confirmed on 2026-10-15 in the continuation chat.

1. The invoice displays “Draft” until first becoming Ready. At that transition it receives its business’s next permanent number, starting at `INV-0001`, and consumes monthly allowance.
2. The freelancer sets the issue date and due date, using the default 14-day payment terms where applicable.
3. The freelancer adds line items with description, quantity, and unit price; the application calculates each line total.
4. The freelancer may apply a fixed-amount or percentage discount.
5. Tax starts off; the freelancer may enable it and supply a rate.
6. The freelancer may include a message and payment instructions in notes.

The fixed `INV-` sequence does not reset yearly; numbers do not change with editing/cancellation and are never reused. Calculation order is defined in the PRD; exact rounding mechanics and remaining validation rules are unresolved.

## Confirmed lifecycle labels

Confirmed on 2026-10-15: Draft → Ready → Partially paid → Paid describes the normal progression when partial payments occur. A full payment can take Ready directly to Paid. Cancelled means voided and retained for records; permitted cancellation transitions remain unresolved.

Ready replaces the previously proposed label Issued. Overdue is an indicator for Ready or Partially paid invoices past their due date. Editing and payment-correction rules are defined below; overdue timing remains unresolved.

## Confirmed editing and correction journey

Confirmed on 2026-10-15 in the continuation chat.

- While Draft, the freelancer can freely edit the invoice.
- While Ready, the freelancer can edit until the first payment is recorded.
- Once a payment is recorded, client, line items, discounts, and tax are locked; notes remain editable.
- The freelancer may cancel an invoice only when no effective payments remain.
- To correct a payment mistake, the freelancer provides a reason; the application retains change history.

The correction interface, editable payment fields, status recalculation after corrections, and whether correcting payments can unlock an invoice remain unresolved.

## Confirmed client management journey

Confirmed on 2026-10-15 in the continuation chat.

1. The freelancer creates a client from client management or during invoice creation.
2. They provide client name and phone; email, company name, address, and KRA PIN are optional.
3. They reuse the saved client on future invoices.
4. Updating the saved client profile preserves client details on existing invoices.
5. Archiving a client hides that client from new selections and preserves existing invoices.

Phone validation, duplicate handling, archive restoration, and explicit replacement of preserved invoice client details remain unresolved.

## Confirmed invoice sharing journey

Confirmed on 2026-10-15 in the continuation chat.

1. The freelancer can download an invoice as PDF or share its public link.
2. WhatsApp sharing opens a prepared message containing the link.
3. Email sharing opens a prepared draft in the freelancer's email app.
4. The client opens the public link without creating an account.
5. Public links do not allow viewing Draft or Cancelled invoices.

PDF layout, message wording, link expiry/revocation, public information visibility, and unavailable-invoice page behavior remain unresolved.

## Confirmed returning-user dashboard journey

Confirmed on 2026-10-15 in the continuation chat.

1. The freelancer views outstanding balance across Ready and Partially paid invoices, overdue balance, and payments received this month using recorded payment dates.
2. Recent invoices show client, due date, balance, and status.
3. The freelancer can use Create Invoice, Add Client, and Record Payment quick actions.

Draft and Cancelled invoices are excluded from balance totals. Reporting month boundaries, recent-invoice ordering/count, mixed-currency totals, and correction effects remain unresolved.

## Confirmed account scope

Confirmed on 2026-10-15: email verification is skipped for V1, and an account supports multiple businesses. Users create their first business after registration and use a business selector to switch businesses or add another. Each business has separate clients, invoices, payment instructions, numbering, and dashboard totals. In V1 the owner manages all their businesses alone; team invitations and staff permissions are deferred. Remaining ownership rules, business limits, business deletion/archival, remain to be finalized. Account recovery is confirmed below.

## Confirmed password recovery journey

Confirmed on 2026-10-15 in the continuation chat.

1. The user selects “Forgot password?”.
2. The application emails a time-limited reset link.
3. The user follows the link and sets a new password without needing support.

Registration email verification remains skipped. Exact expiry, invalid/expired-link behavior, and session handling after reset remain unresolved.

## Confirmed plan allowance journey

Confirmed on 2026-10-15 in the continuation chat.

Free accounts have 10 invoices per month; Pro accounts have 100, shared across all account businesses. Each invoice counts only when it first becomes Ready. Drafting, editing, downloading, sharing, and recording payments do not count again. Cancellation after Ready does not restore allowance, and unused allowance does not roll over.

At the cap, users can still access/share existing invoices, record payments, and manage clients. Making another invoice Ready requires an available allowance after upgrade or the next monthly reset. No higher tier beyond Pro is confirmed; exact Pro-cap handling and reset/upgrade accounting remain open.

## Confirmed Pro purchase and renewal journey

Confirmed on 2026-10-15 in the continuation chat.

1. The user selects Pro on the account Billing page and reviews KES 500/month, the 100-invoice allowance across businesses, and the subscription period.
2. They enter a phone number and approve the M-Pesa STK Push.
3. The backend confirms the successful payment against the pending purchase and activates account-wide Pro, showing its renewal date. Closing the browser does not prevent later backend confirmation.
4. The user receives a reminder before expiry and approves a new payment to renew. There are no automatic monthly deductions.
5. Early renewal extends from the current expiry; late renewal starts a new period on reactivation.
6. If not renewed, the account returns to Free with all records preserved. Existing invoices remain viewable/shareable and payments can still be recorded; new Ready invoices follow Free allowance rules.

Monthly billing only at launch. Exact reminder delivery, failure/pending screens, month-end billing, allowance transitions, and refunds remain unresolved.

## Other unresolved journeys

Detailed invoice revision/cancellation flows, remaining public-view details, remaining subscription transition details and account-management details have not been finalized. Team access is deferred beyond V1.

## Confirmed invoice presentation constraint

Confirmed on 2026-10-15: the user requested keeping invoices concise and leaving out payment history.

Do not display itemized payment history on the public invoice or PDF: omit per-payment dates, methods, references, and amounts. This presentation rule does not remove manually recorded payments or their correction history from application records.

The compact summary is confirmed on 2026-10-15 by the user’s “okay”: show Invoice total, Payments received, and Balance due, with no individual transaction dates, methods, or references. Detailed payment records remain inside the app. The layout is confirmed: one V1 template with business details/optional logo, client and invoice details, line items, totals, compact payment summary, and optional notes/payment instructions. Hide empty optional fields. PDFs use A4 pages; public invoices adapt to mobile. PDF/public-page update behavior is confirmed in the public-link section below.

## Confirmed public invoice links

Confirmed on 2026-10-15 by the user's “yes” in response to the public-link proposal.

Each invoice has a unique, hard-to-guess public link accessible without an account. Show the current invoice status and compact payment summary; newly recorded payments update the public balance. PDFs remain snapshots from generation time, and users can download fresh copies.

Owners can disable or replace a link. Replacement must invalidate the previous link. Draft and Cancelled invoices remain unavailable publicly; Paid invoices may remain accessible as records. Specific token generation/storage, link expiry policy, and unavailable-link page design remain unresolved.

## Updated onboarding phone requirement

Confirmed on 2026-10-15: require a phone number during individual or business setup. Prefill the personal M-Pesa number field from that profile phone, while allowing users to edit it independently. Payment instruction setup remains skippable. This supersedes the earlier optional-profile-phone rule; it does not require the payment number to remain equal to the contact phone. Exact phone validation and later profile-update synchronization remain unresolved.

## Confirmed invoice client-name display

Confirmed on 2026-10-15 by the user's “okay. adopt this”.

Show Client name as the primary Bill to name. If an optional company name is provided and differs from the client name, show it beneath the client name. If the client is entered directly as a business name, Company name may be left empty. Do not repeat the company name when both fields contain the same name. Existing invoices retain their client-detail snapshot under the previously confirmed preservation rule.

Exact normalization for duplicate-name comparison remains an implementation detail. This adopts display behavior, not approval of the complete client-management screen.

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
