# TallyNest — proposed implementation plan

Last updated: 2026-10-15
Status: proposed delivery sequence based on confirmed requirements; not authorization to implement or evidence of completed development.

## Approved design foundation

Dashboard, invoice editor, client-facing invoice, onboarding, client management, business settings, account billing, invoice management, and mobile navigation have approved visual directions. Use deep teal #0F766E, 6px panels, consistent desktop left navigation, and a collapsed mobile menu. Downloaded PDFs use white backgrounds and dark text. See brand-and-design.md for approval scope and remaining details.

## Phase 1 — Application and account foundation

Establish Next.js/TypeScript frontend, NestJS backend, PostgreSQL with Drizzle and Drizzle Kit migrations, and Better Auth with its Drizzle adapter. Use the adopted shared-table model from [database-model.md](database-model.md), with backend ownership checks on every business operation. Implement registration/login/logout and emailed time-limited password recovery; skip registration email verification. Support account-owned multiple businesses, onboarding, required profile phone, editable personal M-Pesa prefill, and skippable payment setup. Implement business selection and owner-only access; team access is deferred.

Verification: a user can create/switch businesses, cannot access another account's business records, and can recover account access using an expiring reset link.

Settled: monorepo layout (D046), Better Auth inside NestJS, one-hour reset links, sign-out-everywhere on reset, and Kenyan phone format (D047). Still open: ID types, production email provider, hosting, and business lifecycle/limits.

## Phase 2 — Clients and invoice core

Implement confirmed client fields, search/archive/edit flows, preserved invoice client details, and Bill to display rules. Build Draft invoice creation and approved editor, optional invoice-level fixed/percentage discount, optional tax after discount, and round-half-up rounding to two decimals at each line total, discount, and tax using decimal arithmetic. On first Ready transition, assign an immutable business-specific INV-0001 sequence and consume account allowance consistently under concurrent requests.

Verification: client edits do not silently change existing invoices; invoices calculate correctly; numbering is unique within a business and not reused after cancellation; repeated Ready transitions do not consume allowance twice.

Settled before implementation: precision, padding, snapshot timing, and input limits (D048); phone format (D047). Still open: payment-instruction multiplicity.

## Phase 3 — Manual payments, dashboard, and sharing

Implement multiple manual payments, reject payments above outstanding balance, update balance/status, and enforce confirmed post-payment editing/cancellation rules. Implement payment corrections and reversals with required reasons and retained change history; invoices stay locked after any payment activity. Build dashboard totals, invoice search/filter/details, account-free hard-to-guess links with disable/replace controls, and mobile presentation. Generate neutral A4 PDFs with the compact payment summary and no payment history. WhatsApp opens a prepared message; email opens a user-app draft.

Verification: balances and statuses remain consistent; Draft/Cancelled invoices cannot be viewed publicly; replaced/disabled links stop working; PDFs are snapshots; app/public invoice views reflect newly recorded payments.

Settled before implementation in D049: overdue and reporting timezone, change-history display, public visibility and 30-day link expiry, PDF pagination, and share copy. Refunds are deferred beyond V1.

## Phase 4 — Plans and subscription billing

Implement account-level Free (10 invoices per Africa/Nairobi calendar month) and Pro (100 invoices per paid monthly period anchored to activation, KES 500 per period) with first-Ready counting, no rollover, no allowance restoration on cancellation, and retained record access at the cap/expiry. Implement Free-to-Pro usage carry-over, the downgrade cap on expiry, user-approved renewal, early extension from expiry, late activation from confirmation, early cancellation with undo, and reminders. See [database-model.md](database-model.md) for the adopted billing rules. Keep subscription payments separate from tenant invoice payments.

Settled in D051: collection runs through a platform Paybill with Daraja M-Pesa Express (STK Push), developed against a fake provider and the Daraja sandbox. Each confirmed payment grants one month; reactivation carries only Free usage; packs of 50 invoice credits cost KES 250, work on both plans, and never expire; reminders go by email three days before and on the expiry day; prices show without tax or fee lines; refunds are handled by support. Duplicate, delayed, and failed confirmations never grant access twice. Production Paybill approval and credentials remain to be arranged.

## Phase 5 — Release readiness

Complete account screens, empty/loading/error states, keyboard/focus accessibility, responsive checks, PDF visual checks, backups/recovery, deployment, monitoring, and launch acceptance criteria. Confirm name availability and final branding assets before public launch. Validate the full registration-to-invoice/payment journey and plan enforcement. No launch date is yet committed.

Settled in D052: Resend for email, Sentry plus an uptime check for monitoring, logos stored in PostgreSQL, system light and dark themes, name and password in account settings, and a Free-only "Created with TallyNest" footer. Business and account settings, error and not-found screens, and the dark-mode contrast pass are built. The remaining release steps are listed in [launch-checklist.md](launch-checklist.md).

## Documentation and design source handling

Maintain confirmed requirements in PRD/journeys/architecture and record changes in decisions.md. Earlier log entries are historical; later decisions supersede them. Interactive design previews are packaged in [designs/README.md](designs/README.md) as standalone browser previews plus editable source fragments, ready to be versioned with the project. Do not treat placeholder preview logic or sample records as production specifications.
