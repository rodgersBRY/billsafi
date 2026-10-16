# Decision log

Recorded: 2026-10-15. Original discussion dates are not assigned where unnecessary; entries preserve discussion order.
Source: Invoice App Development (6ad0c84b-7ef8-83ea-9e21-6e3a322e0c47).

## D001 — Product and architecture foundation

Status: carried forward from accepted discussion summary.

Kenyan freelancers; freemium multi-tenant invoicing SaaS; responsive web application; multi-tenant modular monolith; Next.js/TypeScript, NestJS, PostgreSQL; primary currency KES.

Evidence: the assistant's foundation/scope summaries, followed by the user's “okay” after the manual-payment scope summary. Detailed technology and commercial implementation choices remain unresolved.

## D002 — Manual payments for V1

Status: confirmed by explicit user request; supersedes integrated payment collection for V1.

User: “can we for now put a hold on the mpesa payment integration. Let's have manual to avoid these complications in the beginning”.

Outcome: off-platform payment collection and manual recording. The subsequent accepted flow supports payment instructions, multiple payments, and balance updates. M-Pesa integration is deferred; a future release date and provider are unconfirmed.

## D003 — Prior integrated personal-number payment direction

Status: superseded for V1 by D002.

The user previously preferred Option B, described as personal M-Pesa-number onboarding through a supporting provider. This is historical context, not an active V1 requirement or a verified provider capability. Future integration needs a fresh decision.

## D004 — Onboarding details

Status: partially resolved by D006; remaining proposals unresolved.

The assistant proposed registration fields, verification, individual/business profiles, optional business details, saved payment methods, and a five-minute first-invoice target. The next user message requested documentation; it did not explicitly approve those details. See the PRD for the proposal and open questions.

## D005 — Living project documentation

Status: confirmed by explicit user requests in the original and current chats.

Maintain Markdown in the project's docs/ folder when important discussions are finalized, including PRD, user journeys, architecture, and decisions. Record only confirmed decisions as requirements and label unresolved choices clearly.

## D006 — Adopt onboarding and business setup

Status: confirmed on 2026-10-15 by the user's “adopt this” in the continuation chat.

Adopted recommendation:

- Account: full name, email, password.
- Invoice identity: individual or business, display name, contact email.
- Optional: phone, logo, address, KRA PIN.
- Payment instructions: personal M-Pesa number, Till, Paybill, or bank details; setup may be skipped initially.
- Defaults: KES and 14-day payment terms, editable per invoice.

This resolves the corresponding parts of D004. Other earlier onboarding proposals remain unresolved, including email verification behavior, the five-minute target, business registration document requirements, multiple saved methods, and detailed payment fields. Invoice numbering, line items, taxes, discounts, and notes are the next discussion topics, not adopted requirements.

## D007 — Adopt invoice preferences

Status: confirmed on 2026-10-15 by the user's “adopt” in the continuation chat.

- Automatic sequential numbering, such as `INV-0001`.
- Line items: description, quantity, unit price, calculated total.
- Issue and due dates, defaulting to 14-day payment terms.
- Optional fixed-amount or percentage discount.
- Optional tax, off by default, with a user-supplied rate.
- Optional notes containing a message and payment instructions.

This resolves the preference topics left open in D006. Exact numbering rules, discount scope, tax/discount calculation order, rounding, validation, and statutory compliance requirements remain unresolved. The example number is illustrative, not a confirmed exact format.

## D008 — Adopt invoice lifecycle with Ready label

Status: confirmed on 2026-10-15 in the continuation chat.

The assistant proposed Draft, Issued, Partially paid, Paid, and Cancelled, with Overdue as an indicator. The user requested replacing Issued with “ready,” then replied “yes” following acknowledgement of that change. The revised lifecycle is adopted with Ready as the label.

- Draft: editable, not yet issued.
- Ready: finalized and ready to share; no payment recorded.
- Partially paid: some payment received; balance remains.
- Paid: nothing outstanding.
- Cancelled: voided and retained for records.
- Overdue: indicator on Ready or Partially paid invoices past their due date.

Detailed transition permissions, editing after Ready, cancellation after payments, payment reversals, and overdue timing remain unresolved.

## D009 — Adopt editing, cancellation, and payment correction rules

Status: confirmed on 2026-10-15 by the user's “yeah” in the continuation chat.

- Draft: freely editable.
- Ready: editable until the first payment is recorded.
- After payment: lock client, line items, discounts, and tax; allow notes to change.
- Cancellation: allowed only when no payments are recorded.
- Payment mistakes: correction allowed with a recorded reason and change history.

This resolves the corresponding open rules in D008. Correction mechanics, payment fields that may be corrected, audit-history implementation, other invoice fields after payment, unlocking after corrections, reversals, overpayments, and refunds remain unresolved.

## D010 — Adopt client management with required phone

Status: confirmed on 2026-10-15 in the continuation chat.

User: “KRA PIN is optional. phone is required. the rest as you stated”.

- Required: client name and phone.
- Optional: email, company name, address, KRA PIN.
- Create clients separately or during invoice creation.
- Reuse saved clients on future invoices.
- Archive clients to hide them from new selections while preserving existing invoices.
- Preserve client details on existing invoices when the saved client profile changes.

The required phone applies to clients; the freelancer/business profile phone remains optional under D006. Phone validation, duplicate handling, archive restoration, and explicit replacement of preserved invoice client details remain unresolved.

## D011 — Adopt V1 invoice sharing

Status: confirmed on 2026-10-15 by the user's “approved” in the continuation chat.

- Download invoices as PDF.
- Share a public invoice link.
- WhatsApp sharing opens a prepared message with the link.
- Email sharing opens a prepared draft in the user's email app.
- Clients can view invoices without an account.
- Draft and Cancelled invoices cannot be viewed through public links.

PDF layout, prepared message content, link lifecycle, publicly visible details, and unavailable-invoice page behavior remain unresolved. Direct platform email delivery is not part of this adopted proposal.

## D012 — Adopt V1 dashboard

Status: confirmed on 2026-10-15 by the user's “yes” in the continuation chat.

- Outstanding balance across Ready and Partially paid invoices.
- Overdue balance.
- Payments received this month based on recorded payment dates.
- Recent invoices showing client, due date, balance, and status.
- Quick actions: Create Invoice, Add Client, Record Payment.
- Exclude Draft and Cancelled invoices from balance totals.

Reporting timezone/month boundaries, recent-invoice count/order, mixed-currency aggregation, correction effects, and overdue timing remain unresolved.

## D013 — Adopt invoice calculations

Status: confirmed on 2026-10-15 by the user's “adopt”; optional discounts subsequently clarified and acknowledged.

Line total is quantity × unit price. Apply one optional invoice-subtotal discount (fixed amount or percentage), then calculate enabled tax on the discounted amount. Round monetary amounts to two decimal places. Reject discounts above subtotal and payments above outstanding balance in V1. No discount is the default.

Exact rounding mode/stages, remaining validation limits, correction behavior, and refund handling remain unresolved.

## D014 — Skip verification and support multiple businesses

Status: confirmed on 2026-10-15 in the continuation chat.

The user requested skipping email verification and explicitly required multiple businesses per account. Both are adopted for V1. Business data remains tenant-isolated.

Authentication framework is being discussed and remains unselected. Password recovery, switching flows, ownership/membership rules, team access, business-count limits, and subscription scope remain unresolved.

## D015 — Select Better Auth

Status: confirmed on 2026-10-15 in the continuation chat.

User: “I also agree on better auth”.

Better Auth is selected as the authentication framework for the Next.js/NestJS application. This resolves the framework selection left open in D014. Email/password registration, skipped email verification for V1, and multiple businesses per account remain confirmed requirements.

This approval selects the framework only. Password recovery/email delivery, business selector behavior, team invitation deferral, the organization plugin, and the specific integration/session implementation remain unresolved recommendations.

## D016 — Adopt owner-managed multiple businesses

Status: confirmed on 2026-10-15 by the user's “ye” in the continuation chat.

- Create the first business after registration.
- Use a business selector to switch businesses or add another.
- Keep clients, invoices, payment instructions, invoice numbering, and dashboard totals separate per business.
- The account owner manages all their businesses alone in V1.
- Defer team invitations and staff permissions beyond V1.

This resolves the corresponding switching and team-access recommendations left open in D015. Business-count limits, ownership transfer, business deletion/archival, subscription scope, exact numbering rules, password recovery, and the specific Better Auth organization/integration design remain unresolved.

## D017 — Include password recovery in V1

Status: confirmed on 2026-10-15 by the user's “yes” in the continuation chat.

Include “Forgot password?” with a time-limited reset link sent by email. Users can set a new password through the link without support. Configure email delivery for reset messages. Registration email verification remains skipped, and invoice email sharing continues to open a draft in the user's email app.

This resolves the password-recovery scope left open in D015/D016. Email provider, sender configuration, exact expiry, reset-page behavior, and post-reset session handling remain unresolved.

## D018 — Adopt account-level subscriptions

Status: confirmed on 2026-10-15 in the continuation chat.

The user clarified “One subscription covering all businesses” when asked whether they meant a subscription or a single-invoice limit.

One subscription covers all businesses managed by an account. Plan allowances are shared across those businesses; business data and dashboard totals remain separate. No one-invoice limit is adopted.

Pricing, allowance amounts, paid features, subscription collection, billing cycle, and upgrade/downgrade behavior remain unresolved.

## D019 — Adopt Free/Pro launch plans and counting rules

Status: confirmed on 2026-10-15 by the user's “I agree with your suggestion” in the continuation chat.

Launch with Free (10 invoices/month) and one paid plan, Pro (100 invoices/month). Both include the essential invoicing workflow. Allowances are shared across all account businesses.

Count an invoice when it first becomes Ready. Drafts, edits, downloads, sharing, and payment recording consume no additional allowance. Cancellation after Ready does not restore allowance. Unused allowance does not roll over.

At the cap, retain existing invoice access/sharing, payment recording, and client management. Making more invoices Ready requires upgrade or the next reset. No higher tier beyond Pro is adopted; precise Pro-cap handling remains open.

Pricing, reset schedule/timezone, upgrade/downgrade usage accounting, subscription collection, and business-count limits remain unresolved.

## D020 — Adopt Pro pricing and integrated subscription confirmation

Status: confirmed on 2026-10-15 in the continuation chat.

User: “lets integrate mpesa confirmation” and “The other suggestions are valid to me. Lets adopt those”.

Adopt KES 500/month account-wide Pro, monthly billing only, and integrated M-Pesa STK Push checkout with backend confirmation into the platform's business collection account. Activate only after matching confirmed successful payment to the pending subscription purchase. Prevent transaction reuse/duplicate activation; handle delayed results, failures, and browser closure.

One calendar month per subscription period; paid allowance follows that period. Initial upgrade provides a total allowance of 100, not 100 added to remaining Free allowance. Exact usage mapping remains open. Renewals require user approval, with pre-expiry reminders; no automatic deductions. Early renewal extends existing expiry; late renewal starts on reactivation.

On expiry, return to Free and preserve all businesses and records, existing invoice access/sharing, and payment recording. New Ready invoices follow Free allowance rules. Keep subscription payments separate from tenant invoice payments; manual client invoice collection remains unchanged in scope.

Open: M-Pesa account type/eligibility, Till versus Paybill, production credentials/onboarding, integration details, reset and upgrade/downgrade accounting, month-end/timezone rules, reminder delivery, tax/fee presentation, and refunds. No account connection or implementation has occurred. The price is an initial launch price to review with real usage.

## D021 — Plan around a personal M-Pesa number for now

Status: current user constraint, recorded on 2026-10-15.

User: “for now, lets keep in mind it'll be a personal number” and requested moving on.

A platform business collection account is not confirmed. This updates D020's collection-account assumption. Integrated subscription confirmation remains the desired behavior, but eligibility and the integration route for a personal number remain unresolved. No direct STK Push compatibility, provider selection, or manual fallback is adopted. Revisit before checkout implementation.

## D022 — Adopt invoice numbering rules

Status: confirmed on 2026-10-15 by the user's “okay” in the continuation chat.

Separate sequence per business, beginning `INV-0001`, followed by `INV-0002`, with no yearly reset. Different businesses may share visible numbers. Fixed `INV-` prefix for V1; custom prefixes/starting numbers deferred.

Drafts display “Draft” without a permanent number. Assign the number when first becoming Ready and count the invoice toward the account allowance. Keep the assigned number fixed through edits/cancellation; never reuse cancelled numbers.

Allocation implementation and padding beyond 9999 remain open; no gapless-sequence guarantee adopted. The four-digit format is superseded by D048 (`INV-00001`).

## D023 — Omit payment history from invoices

Status: confirmed on 2026-10-15 in the continuation chat.

User: “I don't want to include lots of details in the invoice and make it unnecessarily long. leave out payment history”.

Exclude itemized payment history from public invoices and PDFs to keep them concise. Recorded payments and correction history remain application records under earlier decisions. Compact total-payments/balance summary, the overall template, and PDF/public update behavior remain awaiting explicit confirmation.

## D024 — Adopt compact invoice payment summary

Status: confirmed on 2026-10-15 by the user's “okay” in response to the compact-summary proposal.

Show Invoice total, Payments received, and Balance due on the invoice/PDF without individual transaction dates, methods, or references. Detailed payment records remain inside the app. This resolves the compact-summary choice left open in D023. The full template, zero-payment display behavior, and PDF/public-page update behavior remain unconfirmed.

## D025 — Adopt core invoice template layout

Status: confirmed on 2026-10-15 by the user's “okay” in the continuation chat.

One clean V1 template: business details and optional logo at top, client/invoice details below, followed by line items, totals, compact payment summary, and optional notes/payment instructions. Hide empty optional fields. PDFs use A4 pages; public invoices adapt to mobile. Payment history stays omitted under D023/D024.

Exact typography/colors/spacing, pagination, zero-payment summary display, and PDF/public-page update behavior remain unresolved.

## D026 — Adopt public-link and PDF update behavior

Status: confirmed on 2026-10-15 by the user's “yes”.

Unique hard-to-guess invoice links, no client account required, current status and compact payment summary reflecting recorded payments. PDFs are snapshots; fresh copies can be downloaded. Owners may disable or replace links, invalidating replaced links. Draft/Cancelled invoices unavailable publicly; Paid invoices may remain available as records.

Detailed token implementation, expiry policy, and unavailable-link design remain unresolved.

## D027 — Select TallyNest and deep teal

Status: confirmed on 2026-10-15.

User: “I like tallynest and the deep teal”.

Adopt TallyNest as the product brand name and deep teal (`#0F766E`) as its primary brand colour. Name/domain/trademark availability remains unchecked. Supporting palette, logo, typography, reference designs, and screen layouts are not yet adopted.

## D028 — Approve dashboard visual direction

Status: confirmed on 2026-10-15 by “yeah it feels right” after reviewing the dashboard concept.

Adopt the dashboard's displayed TallyNest/deep-teal visual direction, neutral surfaces, business selector, left desktop navigation, metric summaries, recent-invoice list, and principal actions. User adjusted summary/list panel corners to 6px. Sample data and placeholder interactions do not establish new product behavior. Other screens, mobile navigation details, final logo, and detailed typography remain open.

## D029 — Approve invoice editor layout

Status: confirmed on 2026-10-15 by “I like the layout”.

Adopt grouped invoice editing sections with live preview alongside on desktop and stacked on narrower screens, Save draft / Mark as Ready actions, optional discount/tax controls revealed on enablement, deep teal primary actions, and 6px panel corners. Keep the compact payment summary without payment history.

Approval is for layout/visual direction; sample values, mock persistence, assigned numbers, and simplified calculations/validation are not new requirements. Error states, mobile refinements, and remaining field/action details remain open.

## D030 — Approve client-facing invoice design

Status: confirmed on 2026-10-15 by “yes” after reviewing the concise public invoice concept.

Adopt the displayed layout and PDF action placement, business/client/date details, line-item table, compact payment summary, payment instructions, and contact information. No itemized payment history. Retain TallyNest's teal/neutral styling and responsive presentation.

Preview selectors, sample data, placeholder payment text, and mock PDF behavior are demonstrations. Footer branding policy, exact copy, conditional discount/tax rows, and detailed pagination/responsive behavior remain open.

## D031 — Adopt neutral print-friendly PDFs

Status: confirmed on 2026-10-15 by “thats fine”.

White PDF background, black/dark-grey text, neutral headings, thin grey dividers, bold totals. Lead with the freelancer's business name and optional logo; retain the approved layout and compact payment summary. Do not impose TallyNest teal on downloaded invoices. Uploaded logos may retain their colours. Footer branding policy remains open.

## D032 — Require profile phone and prefill personal M-Pesa

Status: confirmed on 2026-10-15 by explicit user request.

Require phone in individual/business setup. Prefill the personal M-Pesa field with the same number, but allow editing. Supersedes D006's optional profile phone; client phone remains required. Payment setup remains skippable. Do not overwrite a separately edited payment number with contact-phone changes; exact later synchronization/validation rules remain unresolved.

## D033 — Approve revised onboarding design

Status: confirmed on 2026-10-15 by “but I approve the onboarding design”.

Approve the revised three-step onboarding layout, including required profile phone, editable personal M-Pesa prefill, skippable payment setup, optional business details, KES/14-day defaults, and completion/first-invoice entry. This resolves the onboarding design review; sample data and mock behavior are not production specifications.

## D034 — Adopt invoice client-name display rule

Status: confirmed on 2026-10-15 by “okay. adopt this”.

Client name is the primary Bill to name. Display an optional different company name underneath. Company name may be empty when Client name already identifies the business. Suppress duplicate company/client names. Preserve existing invoice client snapshots as previously agreed. Duplicate comparison normalization remains an implementation detail. Full client-management design approval remains pending.

## D035 — Approve client-management design

Status: confirmed on 2026-10-15 by “yea” in response to approval of the rest of the client-management layout.

Adopt the reviewed client list, business selector, search, Active/Archived views, add/edit form, and archive confirmation, following confirmed field requirements and invoice-preservation behavior. Retain the teal/neutral styling and 6px panels. Sample data and simplified mock behavior are not production requirements. Phone validation, duplicate handling, and archive restoration remain unresolved.

## D036 — Keep invoice defaults focused on user settings

Status: confirmed on 2026-10-15 by explicit user request.

Remove system-only information, including number assignment and PDF appearance, from the Invoice defaults settings UI. The revised design removes the static numbering/document-style block and keeps editable defaults. Numbering and PDF behavior remain unchanged as product requirements. Full business-settings design approval remains pending.

## D037 — Approve revised business settings

Status: confirmed on 2026-10-15 by “this is fine. move on to the next thing”.

Approve the revised three-tab business-settings layout with profile, payment instructions, and user-editable invoice defaults. System-only numbering/PDF details remain omitted under D036. Keep account billing separate. Mock data and simplified field behavior do not establish additional requirements.

## D038 — Approve account billing layout

Status: confirmed on 2026-10-15 by “this is fine. move on”.

Approve current-plan/usage display, Pro offer/renewal, M-Pesa checkout concept, and payment/subscription state presentation. Account-wide plan scope and pricing remain as previously agreed. Personal-number collection eligibility and exact billing rules remain unresolved; visual approval does not select a feasible integration route. Preview-only caveats/selectors are not production UI requirements.

## D039 — Approve invoice management and consistent navigation

Status: confirmed on 2026-10-15 by “okay. approved”.

Adopt the reviewed invoice list/search/filter, details, contextual actions, and manual-payment form. Keep the left navigation (Overview, Invoices, Clients, Settings) and business selector consistent throughout the signed-in business app. Access account settings/billing through the account menu. Collapse desktop sidebar into a menu on smaller screens; detailed mobile behavior remains open. Public invoice and authentication/onboarding contexts are separate. Preview-only simplifications do not supersede existing product rules.

## D040 — Approve mobile navigation

Status: confirmed on 2026-10-15 by “yes it does”.

Approve the reviewed top-left mobile menu, business switching and section navigation, account-area billing/settings access, compact invoice cards, stacked metrics, and single-column forms. Production focus handling, full mobile form details, and error/empty/loading states remain implementation work.

## D041 — Reconfirm PostgreSQL

Status: confirmed on 2026-10-15 by “okay lets stick with postgres”.

Retain PostgreSQL after discussing MongoDB. This reaffirms D001's database direction without adopting a database change. Detailed table/schema design and ORM selection remain unresolved; the previously discussed table count is a proposal, not a finalized schema.

## D042 — Adopt refined PostgreSQL model, rounding, and retention

Status: confirmed on 2026-10-15 by “adopt”.

Adopt the refined shared-table/account-business ownership model and twelve application entities alongside Better Auth's supported authentication tables. Retain separate invoice items, structured historical invoice snapshots, account-level subscription/usage, database relationship constraints, and atomic Ready/payment operations. Use PostgreSQL numeric and backend decimal arithmetic. Round half up at line totals, calculated discount, and tax; sum rounded lines and apply tax after discount. Calculate received/balance from effective payment records rather than an editable paid field.

Retain issued financial records and payment history; allow permanent deletion of unissued Draft invoices only. No automatic account/business deletion cascade removing financial history. Full specification: database-model.md. Numeric precision, ORM/auth schema, correction/reversal details, billing transitions, and account/business retention policies remain open.

## D043 — Adopt payment corrections and record reversals

Status: confirmed on 2026-10-15 by “ok”.

Allow correcting amount/date/method/reference with required reason and retained before/after/actor/timestamp history; total effective payments cannot exceed invoice total. Recalculate balance/status. Allow reversing erroneous payment records with reason, retaining them but excluding them from totals; wrong-invoice mistakes are reversed then recorded on the correct invoice. Reversal is bookkeeping only, not money movement.

Keep invoice financial fields locked after any payment activity, including after all reversals; notes remain editable. Cancellation requires zero effective payments, refining D009's earlier wording. Preserve history and allowance consumption. Defer dedicated refund workflow; actual refunds are distinct from erroneous-payment reversals. Reinstatement behavior remains unresolved.

## D044 — Adopt billing transitions and early cancellation

Status: confirmed on 2026-10-15 by “adopt”.

Free allowance resets each calendar month in Africa/Nairobi time. Pro has monthly activation-anniversary periods; early renewal extends paid access without unlocking the next period's allowance early. Month-end clamps to last day while preserving the original anniversary anchor.

Free-to-Pro carries current Free-month usage into first paid period (7 used means 93 remaining). On expiry, Free allowance counts all first-Ready invoices in the current calendar month, including Pro invoices; at 10+ wait for reset or reactivate Pro. Preserve first issuance once, records, sharing, and payment recording. Exact expired-Pro reactivation/repeated-cycle accounting remains open.

Early cancellation retains access through all paid periods (including prepaid), adds/resets no allowance, stops renewal reminders, and shows access-until date. Undo before expiry restores active state/reminders at no charge without changing dates/usage; next renewal still needs payment approval. No automatic prorated unused-day refunds in V1. Refund policy for duplicate payments/failed activations remains unresolved.

## D045 — Select Drizzle and teach during implementation

Status: confirmed on 2026-10-15.

User: “i haven't used drizzle before. But we can use it and then you can teach me the hang of it as we go”.

Select Drizzle for PostgreSQL access, with Drizzle Kit migrations and compatible Better Auth integration. Explain schema definitions, relationships, queries, transactions, and migrations using the project as it develops. Dependency versions, numeric precision/scale, and decimal-library selection remain implementation choices to finalize.

## D046 — Adopt repository layout and Phase 0 tooling

Status: adopted on 2026-10-16 when the user approved starting Phase 0 from the proposed plan.

pnpm workspace monorepo with Turborepo: `apps/web` (Next.js), `apps/api` (NestJS, routes under `/api/v1`), `packages/db` (Drizzle schema and migrations), `packages/domain` (shared business rules), `packages/config`. Local PostgreSQL 18 runs through Docker Compose. Money uses `decimal.js` with half-up rounding. Vitest runs unit and API end-to-end tests; GitHub Actions runs format, build, typecheck, lint, and tests. TypeScript stays on 6.0 until typescript-eslint and the Nest CLI support 7.

The logo animation is used for route-level loading and a skippable post-login intro capped at two seconds. Hosting, the email provider for production, and numeric precision remain open.

## D047 — Settle password reset, session, auth placement, and phone format

Status: confirmed on 2026-10-16 by the user's answers before Phase 1.

- Password reset links expire after one hour.
- A successful reset signs the account out of every existing session.
- Better Auth runs inside the NestJS API. Next.js uses the Better Auth client and sends the session cookie to the API.
- Profile and client phone fields accept Kenyan numbers only (`07…`, `01…`, `254…`, `+254…`) and store them as `+2547XXXXXXXX` or `+2541XXXXXXXX`.

This resolves the reset-lifetime, post-reset session, and integration-placement items left open in D017 and the phone-format item left open in D010 and D032. Session duration uses Better Auth's defaults until a separate decision changes it.

## D048 — Settle Phase 2 precision, numbering width, snapshot timing, and input limits

Status: confirmed on 2026-10-16 by the user's answers before Phase 2.

- Monetary amounts use `numeric(14,2)`. Quantities use `numeric(12,2)`, so quantities carry at most two decimal places (for example 1.25 hours). Line totals, discounts, and tax still round half up to two decimals.
- Invoice numbers are padded to five digits from the start: `INV-00001`, `INV-00002`, and so on. Numbers above 99999 grow without truncation. This supersedes the four-digit `INV-0001` format in D007 and D022; the fixed prefix, per-business sequence, no yearly reset, and no reuse rules are unchanged.
- Client, business, and payment-instruction details are copied onto an invoice when it is first marked Ready. Drafts show the current saved details. Editing a Ready invoice before any payment activity copies the details again on save; after payment activity the copy stays fixed.
- Input limits: up to 100 line items per invoice; item description up to 500 characters; quantity from 0.01 to 1,000,000; unit price from 0 to 100,000,000; tax rate from 0 to 100 percent; percentage discount from 0 to 100 percent; fixed discount from 0 up to the subtotal; notes up to 2,000 characters.

This resolves the precision/scale, padding, snapshot-timing, and validation-limit items left open in D013, D022, and the database model. `decimal.js` is the decimal library (D046).
