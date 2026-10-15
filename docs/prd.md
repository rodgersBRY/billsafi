# Smart Invoice Generator — PRD

Status: living draft; confirmed direction with unresolved details.
Last updated: 2026-10-15
Source and status conventions: [documentation index](README.md).

## Confirmed product direction

Build a multi-tenant invoicing SaaS for Kenyan freelancers and independent professionals, delivered as a responsive web application. The business model is freemium and the primary currency is KES. Users create invoices, manage clients, and track payments.

This direction is carried forward from the product summary preceding the user's “okay.” Pricing, limits, and detailed acceptance criteria have not been finalized.

## V1 payment scope

The user explicitly requested putting M-Pesa integration on hold and using manual payments initially.

- Clients pay outside the platform using invoice payment instructions.
- Payment instructions may include a personal M-Pesa number, Till, Paybill, bank details, or other instructions.
- Freelancers record received payments manually.
- The agreed flow records amount, method, date, and an optional transaction reference.
- Multiple payments can be recorded against one invoice; the outstanding balance updates, including partial payments.
- Sharing supports PDF download and public invoice links. WhatsApp opens a prepared message with the link; email opens a prepared draft in the user’s email app.

Example from the accepted discussion: a KES 50,000 invoice with KES 20,000 recorded has KES 30,000 outstanding and is partially paid.

## Deferred

Integrated M-Pesa collection, STK Push, provider onboarding, automated payment confirmation, routing, and settlement for freelancers’ client invoice payments are outside V1. Account subscription payments are a separate, confirmed integration described below. The discussion labels integration as V2; no release commitment or provider selection is confirmed.

## Confirmed onboarding and business setup

Confirmed on 2026-10-15 when the user said “adopt this” in response to the setup recommendation in the continuation chat.

- Account registration requires full name, email, and password.
- Invoice identity requires individual or business profile type, display name, and contact email.
- Phone, logo, address, and KRA PIN are optional.
- Payment instructions support a personal M-Pesa number, Till, Paybill, or bank details. Payment setup can be skipped initially.
- Defaults are KES and 14-day payment terms, editable per invoice.

## Confirmed account and business scope

Confirmed on 2026-10-15 in the continuation chat.

- Skip email verification for V1.
- Support multiple businesses per account, with business data isolated by tenant.

Better Auth is the selected authentication framework, confirmed on 2026-10-15. Detailed ownership rules, limits on business count, and subscription billing details are defined below. Business switching and V1 owner-only access are confirmed below. The organization plugin and specific integration approach have not yet been approved.

## Remaining onboarding proposals — unresolved

The five-minute first-invoice target, social login deferral, business registration document requirements, multiple saved payment methods with per-invoice selection, and exact payment-method fields were not included in the adopted recommendation. They remain unresolved.

## Confirmed invoice preferences

Confirmed on 2026-10-15 by the user's “adopt” in the continuation chat.

- Automatic sequential numbering per business, starting at `INV-0001`, with a fixed `INV-` prefix and no yearly reset. Permanent numbers are assigned on first becoming Ready and never reused.
- Line items contain description, quantity, unit price, and calculated total.
- Invoices have an issue date and due date, with payment terms defaulting to 14 days.
- An optional discount can be a fixed amount or percentage.
- Tax is optional and off by default; the user supplies the rate.
- Notes can contain an optional message and payment instructions.

Calculation rules are confirmed below; exact rounding mechanics and remaining validation limits are unresolved. These preferences do not establish tax compliance or statutory invoice requirements.

## Confirmed invoice lifecycle

Confirmed on 2026-10-15 in the continuation chat. The user renamed “Issued” to “Ready” and then confirmed the revised lifecycle.

| Status | Meaning |
| --- | --- |
| Draft | Editable, not yet issued. |
| Ready | Finalized and ready to share; no payment recorded. |
| Partially paid | Some payment received; an outstanding balance remains. |
| Paid | Nothing outstanding. |
| Cancelled | Voided and retained for records. |

Overdue is an indicator on Ready or Partially paid invoices past their due date, rather than a separate lifecycle status.

Detailed transition rules beyond the confirmed editing rules below remain unresolved, including payment reversals and how overdue timing is evaluated.

## Confirmed invoice editing and payment correction rules

Confirmed on 2026-10-15 by the user's “yeah” in response to the proposed rules in the continuation chat.

- Draft invoices are freely editable.
- Ready invoices are editable until the first payment is recorded.
- After a payment is recorded, client, line items, discounts, and tax are locked; notes may still be changed.
- Cancellation is allowed only when no payments are recorded.
- Payment mistakes may be corrected with a recorded reason and change history.

Unresolved details include which payment fields may be corrected, how change history is stored and displayed, whether invoices unlock after payment corrections, treatment of other invoice fields after payment, and reversals/refunds. No deletion or audit-history removal behavior is implied.

## Confirmed client management

Confirmed on 2026-10-15 in the continuation chat. The user required phone, reiterated that KRA PIN is optional, and accepted the remaining proposal.

- Required client fields: client name and phone.
- Optional client fields: email, company name, address, and KRA PIN.
- Clients can be created separately or while creating an invoice.
- Saved clients can be reused on future invoices.
- Clients can be archived to hide them from new selections while preserving existing invoices.
- Changes to a saved client profile preserve the client details on existing invoices.

These requirements apply to client records. The freelancer's own profile phone remains optional under the confirmed onboarding setup.

Unresolved details include phone format and validation, duplicate handling, archive restoration, and whether an explicit invoice edit can replace preserved client details under the confirmed invoice editing rules.

## Confirmed invoice sharing

Confirmed on 2026-10-15 by the user's “approved” in response to the V1 sharing proposal in the continuation chat.

- Users can download invoices as PDF.
- Users can share a public invoice link.
- WhatsApp sharing opens a prepared message containing the invoice link.
- Email sharing opens a prepared draft in the user's email app.
- Clients can view public invoices without an account.
- Draft and Cancelled invoices cannot be viewed through public links.

Unresolved details include PDF layout, prepared message content, link generation/revocation/expiry, which payment and contact details appear publicly, and the page shown for unavailable invoices. Direct email delivery by the platform has not been adopted.

## Confirmed V1 dashboard

Confirmed on 2026-10-15 by the user's “yes” in response to the dashboard proposal in the continuation chat.

- Outstanding balance across Ready and Partially paid invoices.
- Overdue balance.
- Payments received this month, based on recorded payment dates.
- Recent invoices showing client, due date, balance, and status.
- Quick actions: Create Invoice, Add Client, Record Payment.
- Draft and Cancelled invoices are excluded from balance totals.

Unresolved details include reporting timezone/month boundaries, the number and ordering of recent invoices, currency aggregation if invoice currencies differ, and how payment corrections affect dashboard totals. Overdue timing remains unresolved.

## Confirmed invoice calculations

Confirmed on 2026-10-15 by the user's “adopt” in the continuation chat. Discounts remain optional, as subsequently clarified.

- Line total = quantity × unit price.
- Apply one optional fixed-amount or percentage discount to the invoice subtotal; no discount is the default.
- Calculate tax on the amount after discount, when tax is enabled.
- Round monetary amounts to two decimal places.
- Reject discounts above the subtotal.
- Reject recorded payments above the outstanding balance for V1.

Exact rounding mode and intermediate rounding stages, input validation limits, correction behavior, and refund handling remain unresolved.

## Confirmed business management

Confirmed on 2026-10-15 by the user's “ye” in response to the business-management proposal in the continuation chat.

- Users create their first business after registration.
- A business selector lets users switch businesses or add another.
- Each business has separate clients, invoices, payment instructions, invoice numbering, and dashboard totals.
- In V1, the account owner manages all their businesses alone.
- Team invitations and staff permissions are deferred beyond V1.

Business-count limits, deletion/archival, ownership transfer, and subscription billing details are defined below. Numbering rules are confirmed below.

## Confirmed password recovery

Confirmed on 2026-10-15 by the user's “yes” in response to the password-recovery proposal in the continuation chat.

V1 includes a “Forgot password?” option that emails a time-limited reset link. Users set a new password through that link without needing support. Email delivery is required for password-reset messages. This is separate from registration email verification, which remains skipped for V1, and invoice email sharing, which opens a draft in the user's email app.

Email provider, sender configuration, exact link lifetime, reset-page behavior, and session handling after reset remain unresolved.

## Confirmed subscription scope

Confirmed on 2026-10-15 after the user clarified “One subscription covering all businesses”.

One subscription applies to the account and covers all businesses managed by that account. Plan limits, including the free plan's invoice allowance, are shared across its businesses. Business records and dashboard totals remain separate.

Launch plans and allowances are confirmed below. Pro pricing, collection, and monthly billing are confirmed below; detailed allowance accounting remains unresolved. No one-invoice limit has been adopted.

## Confirmed launch plans and invoice allowances

Confirmed on 2026-10-15 by the user's “I agree with your suggestion” in response to the plan and counting-rule proposal in the continuation chat.

| Plan | Monthly invoice allowance |
| --- | ---: |
| Free | 10 |
| Pro | 100 |

Launch with two plans total: Free and one paid plan, Pro. Both include the essential invoicing workflow. Each account's allowance is shared across all its businesses.

An invoice consumes allowance when it first becomes Ready. Draft creation, editing, downloading, sharing, and recording payments do not consume additional allowance. Cancelling an invoice after it becomes Ready does not restore allowance. Unused allowance does not roll over.

After reaching the limit, users retain access to existing invoices, can share them, record payments, and manage clients. They must upgrade or wait for the next monthly reset to make another invoice Ready. Pro also has a fixed cap; behavior at that cap beyond waiting for reset remains to be specified because no higher paid tier is adopted.

Exact reset schedule/timezone, upgrade/downgrade allowance accounting, and business-count limits remain unresolved. Pricing and subscription collection are confirmed below. Additional paid tiers and unlimited invoicing are not adopted for launch.

## Confirmed Pro pricing and subscription payments

Confirmed on 2026-10-15 when the user requested integrated M-Pesa confirmation and adopted the other pricing/subscription suggestions in the continuation chat.

Pro costs KES 500 per month for the account, covering all its businesses and the agreed 100-invoice monthly allowance. Launch with monthly billing only; annual billing is deferred. This is an initial price to review against adoption, support needs, and operating costs.

Use integrated M-Pesa confirmation for subscription purchases into one platform-owned business collection account. The proposed checkout is adopted: users choose Pro, review price/allowance/period, enter their phone number, and approve an STK Push. The backend checks successful payment against the pending subscription purchase before activating Pro and displaying its renewal date. A submitted transaction code alone must not activate access. Prevent reuse of a transaction across purchases, handle duplicate notifications without duplicate activation, and support delayed results, failures, and browser closure after payment.

Subscriptions last one calendar month from activation (for example, 15 October to 15 November). Paid invoice allowance follows the subscription period. On initial upgrade, the allowance is a total of 100, not an additional 100 on top of remaining Free allowance; exact usage mapping is unresolved.

Renewal is user-approved each month, not automatic deduction. Send reminders before expiry; timing/channel remain unresolved. Early renewal extends from the existing expiry date; renewal after expiry starts a new period on reactivation.

On expiry without renewal, return the account to Free while preserving all businesses, clients, invoices, and payment history. Continue existing invoice viewing/sharing and payment recording. New Ready invoices follow the Free allowance. Exact downgrade/reset accounting remains unresolved and must prevent gaining extra allowance through repeated plan switching.

Keep platform subscription payments separate from freelancers' invoice payment records. Client invoice collection remains manual/off-platform.

The user's M-Pesa account type and integration eligibility/credentials have not been established. Business Till versus Paybill, production onboarding, exact billing date behavior at month-end, timezone, reminder details, tax/fee presentation, refund policy, and reset/upgrade/downgrade accounting remain open. This decision approves the integration scope; no payment connection or implementation has yet been made.

## Open product decisions

- Confirm the remaining onboarding proposals above; email verification is skipped for V1.
- Invoice templates, available payment-term options, exact rounding mechanics and remaining validation limits.
- Remaining lifecycle transitions, overdue timing, payment-correction details and refunds; overpayments are rejected in V1, and editing and cancellation rules above are confirmed.
- PDF layout, share-message content, public-link lifecycle, public information visibility, and unavailable-invoice page behavior.
- Subscription integration onboarding/account details, reset timing, detailed upgrade/downgrade accounting, month-end billing behavior, reminders, tax/fee presentation, and refund policy; KES 500 monthly Pro and integrated M-Pesa confirmation are confirmed.
- Remaining business ownership rules, business limits and deletion/archival; multiple businesses per account and owner-only management are confirmed, with team access deferred.
- Dashboard reporting details, additional reporting, reminders, supported currencies beyond KES, and measurable release criteria.

## Current subscription collection constraint

Recorded on 2026-10-15: the user asked to plan around a personal M-Pesa number for now and move on to other decisions. A business collection account is not confirmed. The adopted goal of integrated subscription confirmation remains, but personal-number compatibility and an eligible integration route are unresolved. Do not assume direct Daraja/STK Push support for that number or silently substitute manual activation. Revisit collection eligibility before implementing subscription checkout.

## Confirmed invoice numbering rules

Confirmed on 2026-10-15 by the user's “okay” in response to the numbering proposal in the continuation chat.

Each business starts its independent sequence at `INV-0001`, followed by `INV-0002`, continuing without a yearly reset. Different businesses may have the same visible invoice number. The `INV-` prefix is fixed for V1; custom prefixes and starting numbers are deferred.

Drafts display “Draft” and have no permanent invoice number. On first transition to Ready, assign the permanent number and count the invoice toward its account's monthly allowance. Once assigned, the number remains fixed through editing or cancellation. Cancelled numbers are never reused.

Sequence allocation must avoid duplicate numbers within a business. Exact padding behavior beyond 9999 and implementation of allocation remain unresolved. No guarantee of a gapless sequence has been adopted.

## Confirmed invoice presentation constraint

Confirmed on 2026-10-15: the user requested keeping invoices concise and leaving out payment history.

Do not display itemized payment history on the public invoice or PDF: omit per-payment dates, methods, references, and amounts. This presentation rule does not remove manually recorded payments or their correction history from application records.

The compact summary is confirmed on 2026-10-15 by the user’s “okay”: show Invoice total, Payments received, and Balance due, with no individual transaction dates, methods, or references. Detailed payment records remain inside the app. The core invoice layout is confirmed below; PDF/public-page update behavior is confirmed in the public-link section below.

## Confirmed invoice template layout

Confirmed on 2026-10-15 by the user's “okay” in response to the remaining layout proposal.

Use one clean template for V1. Place business details and an optional logo at the top, followed by client and invoice details, line items, totals, the compact payment summary (Invoice total, Payments received, Balance due), and optional notes/payment instructions. Omit payment history. Hide optional fields when empty.

PDFs use A4 pages. The public invoice page adapts to mobile screens. Exact typography, colors, spacing, pagination behavior, remain unresolved; PDF/public update behavior is confirmed below.

## Confirmed public invoice links

Confirmed on 2026-10-15 by the user's “yes” in response to the public-link proposal.

Each invoice has a unique, hard-to-guess public link accessible without an account. Show the current invoice status and compact payment summary; newly recorded payments update the public balance. PDFs remain snapshots from generation time, and users can download fresh copies.

Owners can disable or replace a link. Replacement must invalidate the previous link. Draft and Cancelled invoices remain unavailable publicly; Paid invoices may remain accessible as records. Specific token generation/storage, link expiry policy, and unavailable-link page design remain unresolved.

## Confirmed brand direction

Confirmed on 2026-10-15: the user selected TallyNest and deep teal (`#0F766E`) as the brand name and primary colour. Smart Invoice Generator remains the historical project description. Name/domain/trademark availability has not been checked. Supporting palette, typography, logo, reference designs, and screen layouts remain proposals pending confirmation.

## Confirmed PDF colour treatment

Confirmed on 2026-10-15 by the user's “thats fine”. Downloaded PDFs use a white background with black/dark-grey text, neutral headings, thin grey dividers, and bold totals. The freelancer's business name and optional logo lead the document. TallyNest teal remains in the application interface rather than being imposed on the PDF. Preserve the approved invoice layout and compact payment summary. This does not require recolouring uploaded business logos. Footer branding policy remains unresolved.
