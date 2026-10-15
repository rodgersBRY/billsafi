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

- Database tenancy model and enforcement: no shared-schema, separate-schema, row-level security, or database-per-tenant choice is confirmed.
- Tenant resolution and enforcement of owner-only access in V1. Future membership/permissions design, ownership transfer, and business lifecycle rules remain unresolved; team invitations and staff permissions are deferred.
- Better Auth integration and session strategy; password recovery via emailed time-limited reset links is confirmed for V1, while registration email verification is skipped. Reset-link lifetime and session handling after reset remain unresolved. The organization plugin and specific NestJS integration approach remain to be selected.
- API contracts, module boundaries, database schema, and validation rules. Client name and phone are required; email, company name, address, and KRA PIN are optional.
- Storage of preserved invoice client details and client archival: profile changes must preserve existing invoice details, and archived clients must be hidden from new selections while existing invoices remain available. Implementation details remain open.
- Exact rounding mode/stages, remaining validation, and detailed payment correction semantics. Sequential numbering, line-item fields, optional fixed/percentage discounts, optional user-rate tax off by default, and optional notes are confirmed in the PRD.
- Enforcement and storage of the confirmed editing/cancellation rules and payment correction history (reason and change history required); detailed correction behavior remains open.
- PDF generation and layout, public-link generation/lifecycle, and asset storage. V1 supports PDF download and account-free public invoice viewing; Draft and Cancelled invoices must be unavailable through public links.
- WhatsApp sharing opens a prepared message with the link; email sharing opens a prepared draft in the user’s email app. Implementation and fallback behavior remain open; direct platform email delivery has not been adopted.
- Email provider and sender configuration for password-reset messages. This does not change invoice email sharing into direct platform delivery.
- Hosting, deployment, monitoring, backups, and recovery requirements.
- Dashboard aggregation implementation: outstanding balances for Ready/Partially paid invoices, overdue balance, and monthly receipts using recorded payment dates; Draft/Cancelled invoices excluded from balance totals. Timezone, mixed-currency aggregation, and correction effects remain open.
- Calculation implementation must follow PRD rules: quantity × unit price, one optional subtotal discount, tax after discount, two-decimal monetary rounding, and rejection of discounts above subtotal or payments above balance.
- Account-level subscription billing and freemium enforcement: one subscription covers all account businesses, with plan allowances shared across them. Free allows 10 invoices/month and Pro allows 100; count each invoice on its first transition to Ready, do not restore usage on cancellation, and do not roll over unused allowance. Other invoice operations do not consume allowance. At the cap, preserve existing invoice access/sharing, payment recording, and client management. Pro is KES 500 per calendar month, with user-approved M-Pesa renewals and integrated payment confirmation. Paid allowance follows the subscription period; exact reset/upgrade/downgrade accounting remains unresolved. Usage enforcement must prevent concurrent requests exceeding the cap; implementation remains open.

Better Auth has been selected for authentication. M-Pesa is selected for platform subscription collection, with STK Push checkout and backend confirmation. The collection account, production credentials, and detailed integration path are unresolved. No infrastructure provider or ORM has been selected in these documents.

## Confirmed subscription integration requirements

Maintain pending subscription purchases and platform subscription payment records separately from tenant invoice payments. Match confirmed successful payments to the expected purchase before activation, prevent transaction reuse and duplicate activation, and handle delayed/failed notifications independently of browser state. Specific API verification and reconciliation mechanisms remain to be designed.

Subscriptions renew with user approval, not automatic deductions. Early renewal extends from expiry; late renewal starts at reactivation. Expiry returns the account to Free without removing business records or blocking existing invoice access/sharing and payment recording. Exact month-end rules, reminders, refunds, allowance accounting, and M-Pesa account onboarding remain open.

## Current subscription collection constraint

Recorded on 2026-10-15: the user asked to plan around a personal M-Pesa number for now and move on to other decisions. A business collection account is not confirmed. The adopted goal of integrated subscription confirmation remains, but personal-number compatibility and an eligible integration route are unresolved. Do not assume direct Daraja/STK Push support for that number or silently substitute manual activation. Revisit collection eligibility before implementing subscription checkout.

## Confirmed invoice numbering behavior

Each business has an independent fixed `INV-` sequence starting at `INV-0001`, without yearly resets. Drafts have no permanent invoice number. Allocate the permanent number on first transition to Ready alongside allowance consumption; retain it through edits/cancellation and never reuse cancelled numbers. Custom prefixes/starting numbers are deferred. Enforce number uniqueness within each business and consistent behavior under concurrent transitions/retries; allocation implementation remains open.

## Confirmed invoice rendering layout

Use one V1 template for A4 PDF output and mobile-responsive public invoice pages. Content order: business details and optional logo; client/invoice details; line items; totals; compact Invoice total/Payments received/Balance due summary; optional notes/payment instructions. Hide empty optional fields and omit itemized payment history. Exact visual design, pagination, remain unresolved; PDF/public update behavior is confirmed below.

## Confirmed public invoice links

Confirmed on 2026-10-15 by the user's “yes” in response to the public-link proposal.

Each invoice has a unique, hard-to-guess public link accessible without an account. Show the current invoice status and compact payment summary; newly recorded payments update the public balance. PDFs remain snapshots from generation time, and users can download fresh copies.

Owners can disable or replace a link. Replacement must invalidate the previous link. Draft and Cancelled invoices remain unavailable publicly; Paid invoices may remain accessible as records. Specific token generation/storage, link expiry policy, and unavailable-link page design remain unresolved.
