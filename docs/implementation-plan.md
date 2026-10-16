# TallyNest — proposed implementation plan

Last updated: 2026-10-15
Status: proposed delivery sequence based on confirmed requirements; not authorization to implement or evidence of completed development.

## Approved design foundation

Dashboard, invoice editor, client-facing invoice, onboarding, client management, business settings, account billing, invoice management, and mobile navigation have approved visual directions. Use deep teal #0F766E, 6px panels, consistent desktop left navigation, and a collapsed mobile menu. Downloaded PDFs use white backgrounds and dark text. See brand-and-design.md for approval scope and remaining details.

## Phase 1 — Application and account foundation

Establish Next.js/TypeScript frontend, NestJS backend, PostgreSQL, and Better Auth. Implement registration/login/logout and emailed time-limited password recovery; skip registration email verification. Support account-owned multiple businesses, onboarding, required profile phone, editable personal M-Pesa prefill, and skippable payment setup. Implement business selection and owner-only access; team access is deferred.

Verification: a user can create/switch businesses, cannot access another account's business records, and can recover account access using an expiring reset link.

Open design/technical choices: database tenancy enforcement, ORM/migrations, Better Auth organization/integration/session design, email provider, reset expiry/session policy, hosting, and business lifecycle/limits.

## Phase 2 — Clients and invoice core

Implement confirmed client fields, search/archive/edit flows, preserved invoice client details, and Bill to display rules. Build Draft invoice creation and approved editor, optional invoice-level fixed/percentage discount, optional tax after discount, and monetary rounding to two decimals. On first Ready transition, assign an immutable business-specific INV-0001 sequence and consume account allowance consistently under concurrent requests.

Verification: client edits do not silently change existing invoices; invoices calculate correctly; numbering is unique within a business and not reused after cancellation; repeated Ready transitions do not consume allowance twice.

Resolve before calculation/numbering implementation: exact rounding stages/mode, validation limits, sequence padding beyond 9999, and relevant transition rules.

## Phase 3 — Manual payments, dashboard, and sharing

Implement multiple manual payments, reject payments above outstanding balance, update balance/status, and enforce confirmed post-payment editing/cancellation rules. Include correction reason/change history. Build dashboard totals, invoice search/filter/details, account-free hard-to-guess links with disable/replace controls, and mobile presentation. Generate neutral A4 PDFs with the compact payment summary and no payment history. WhatsApp opens a prepared message; email opens a user-app draft.

Verification: balances and statuses remain consistent; Draft/Cancelled invoices cannot be viewed publicly; replaced/disabled links stop working; PDFs are snapshots; app/public invoice views reflect newly recorded payments.

Resolve before relevant implementation: correction/reversal/refund mechanics, overdue/reporting timezone, public information visibility and link expiry, pagination, and exact share copy.

## Phase 4 — Plans and subscription billing

Implement account-level Free (10 invoices/month) and Pro (100 invoices/month, KES 500/calendar month) with first-Ready counting, no rollover, no allowance restoration on cancellation, and retained record access at the cap/expiry. Implement user-approved renewal, early extension from expiry, late activation from confirmation, and reminders. Keep subscription payments separate from tenant invoice payments.

Integration gate: the current collection preference is a personal M-Pesa number. Direct STK Push/automated confirmation eligibility is unresolved. Verify a supported collection route before checkout integration; do not silently substitute manual activation or assume personal-number Daraja support.

Resolve before billing release: Free reset boundaries, exact upgrade/downgrade accounting, month-end rules, reminder timing/channel, refunds, tax/fee presentation, and collection credentials/onboarding. Handle duplicate/delayed/failed confirmations without duplicate access grants.

## Phase 5 — Release readiness

Complete account screens, empty/loading/error states, keyboard/focus accessibility, responsive checks, PDF visual checks, backups/recovery, deployment, monitoring, and launch acceptance criteria. Confirm name availability and final branding assets before public launch. Validate the full registration-to-invoice/payment journey and plan enforcement. No launch date is yet committed.

## Documentation and design source handling

Maintain confirmed requirements in PRD/journeys/architecture and record changes in decisions.md. Earlier log entries are historical; later decisions supersede them. Interactive design previews currently live outside the Git repository and must be deliberately packaged if they are to become versioned project deliverables. Do not treat placeholder preview logic or sample records as production specifications.
