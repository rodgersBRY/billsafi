# Billsafi — brand and product design

Last updated: 2026-10-15
Status: confirmed brand foundation; visual design in progress.

## Confirmed

Product name: **Billsafi**.
Primary brand colour: **Deep teal — `#0F766E`**.

The product was first named TallyNest (D027, from the user’s “I like tallynest and the deep teal”). It was renamed Billsafi on 2026-10-17 because TallyNest already has a large online presence (D053). The deep teal stays. Name, domain, and trademark availability for Billsafi have not been checked.

## Proposed supporting direction — awaiting confirmation

Warm off-white background, white cards/forms, dark slate text, restrained use of teal, readable financial amounts, and labelled status indicators. Exact supporting colours, typography, logo, spacing, and responsive screen layouts remain unconfirmed.

Wave invoicing and Zoho Invoice dashboard were suggested as reference designs, not approved requirements:

- https://www.waveapps.com/invoicing
- https://www.zoho.com/us/invoice/help/dashboard/

Proposed design sequence: dashboard/navigation, invoice creation, client-facing invoice, then onboarding, client management, settings, and billing. Each of these screens has since been approved in the sections below. The exact supporting colours, typography, and logo listed above are still unconfirmed.

## Approved dashboard direction

Confirmed on 2026-10-15: the user said “yeah it feels right” after reviewing the interactive dashboard concept and adjusting panel corners to 6px.

Adopt the displayed visual direction: deep teal primary actions, neutral backgrounds, white/light panels (with corresponding dark appearance), restrained borders, clear financial amounts, left desktop navigation, business selector, three financial summaries, recent invoices, and Create Invoice / Add Client / Record Payment actions. Use 6px corners for summary and invoice-list panels.

The supporting palette is accepted as part of the displayed direction rather than a separately finalized token specification. Desktop navigation and responsive reflow are design foundations; remaining screens, mobile navigation details, logo, and exact typography still require design review. Preview sample records, totals, placeholder screens, and simplified payment behavior are demonstration content, not new functional requirements. The preview mark is provisional.

## Approved invoice editor layout

Confirmed on 2026-10-15: the user said “I like the layout” after reviewing the interactive invoice editor concept.

Adopt a two-column desktop editor with grouped client/date, line-item, and payment-instruction/note sections beside a live invoice preview. At narrower widths, stack editor and preview. Retain deep teal primary actions and 6px panel corners. Provide Save draft and Mark as Ready actions; optional discount and tax controls are collapsed until enabled. The preview includes the compact payment summary without payment history.

Approval covers the layout and visual direction. Sample data, simplified validation/calculation behavior, local preview messages, and example assigned numbers are demonstrations, not implementation specifications. Final save behavior, error states, mobile refinements, item removal, and detailed invoice preview fields still require implementation/design review.

## Approved client-facing invoice layout

Confirmed on 2026-10-15: the user answered “yes” after reviewing the client-facing invoice and being asked whether it was concise enough.

Adopt the displayed concise layout: PDF download action above the invoice; business identity opposite invoice number/status; client and date details; line-item table; compact Invoice total / Payments received / Balance due summary; payment instructions and contact information below. No payment history. Use the established teal/neutral direction and 6px invoice-panel corners, with responsive reflow.

The preview selector and sample values/contact text are demonstration content, not controls shown to actual clients. The PDF button's mock behavior is not implementation. Final copy, payment details, footer branding policy, conditional discount/tax rows, and remaining detailed responsive/pagination behavior still need implementation review.

## Confirmed PDF colour treatment

Confirmed on 2026-10-15 by the user's “thats fine”. Downloaded PDFs use a white background with black/dark-grey text, neutral headings, thin grey dividers, and bold totals. The freelancer's business name and optional logo lead the document. Billsafi teal remains in the application interface rather than being imposed on the PDF. Preserve the approved invoice layout and compact payment summary. This does not require recolouring uploaded business logos. Footer branding policy remains unresolved.

## Onboarding revision: required phone and editable M-Pesa default

Requested on 2026-10-15: place required phone alongside display name/contact email for both individual and business setup. Remove it from optional details. Prefill the personal M-Pesa field with that phone when entering payment setup, keeping it editable independently. Preserve skip-payment-setup behavior. The revised onboarding layout is approved as recorded below.

## Approved onboarding design

Confirmed on 2026-10-15: the user explicitly approved the onboarding design after the phone-field revision.

Adopt the three-step layout: account creation; individual/business identity with required display name, contact email, and phone; optional payment setup. Optional business details stay collapsed. Personal M-Pesa is prefilled from the setup phone and remains editable. Payment setup can be skipped. Show KES/14-day defaults and a completion screen leading to first-invoice creation. Retain the established teal styling and 6px panels with responsive reflow.

Mock sample data, simplified validation, and placeholder actions are not production requirements. Actual authentication, phone validation, and detailed error states remain implementation work.

## Confirmed invoice client-name display

Confirmed on 2026-10-15 by the user's “okay. adopt this”.

Show Client name as the primary Bill to name. If an optional company name is provided and differs from the client name, show it beneath the client name. If the client is entered directly as a business name, Company name may be left empty. Do not repeat the company name when both fields contain the same name. Existing invoices retain their client-detail snapshot under the previously confirmed preservation rule.

Exact normalization for duplicate-name comparison remains an implementation detail. This adopts display behavior, not approval of the complete client-management screen.

## Approved client-management layout

Confirmed on 2026-10-15 by the user's “yea” when asked whether the rest of the client-management layout works.

Adopt the reviewed client list, business selector, client search, Active/Archived views, add/edit form, and archive confirmation. Name and phone are required; email, company name, address, and KRA PIN remain optional. Keep the preservation notice when editing a client and the archive notice explaining exclusion from new selections while retaining existing invoices. Use the established teal/neutral style and 6px panels with responsive reflow.

This resolves the full-screen design review left open after D034. Sample records, in-memory mock persistence, and simplified validation are demonstrations. Exact phone validation, duplicate handling, archive restoration, and detailed accessibility/error states remain implementation/design work.

## Business settings revision: user-facing invoice defaults

Requested on 2026-10-15: remove system-only details such as number assignment and PDF appearance from the Invoice defaults tab. Remove the static numbering/document-style block, including fixed-sequence and reset/reuse explanations. Keep editable defaults (currency and payment terms) and a brief explanation of their effect on new invoices. System behavior remains documented in the PRD/architecture; this changes presentation only. The overall business-settings design still awaits approval.

## Approved business-settings design

Confirmed on 2026-10-15 by “this is fine. move on to the next thing” after reviewing the revised settings screen.

Adopt Business profile, Payment instructions, and Invoice defaults tabs scoped to the selected business. Invoice defaults shows editable currency/payment terms without system-only numbering/PDF information. Retain required profile phone, independently editable payment details, optional business fields, established teal/neutral styling, and 6px panels. Account settings and subscription billing are separate. Mock values, simplified payment fields, and preview persistence are demonstrations; production validation and remaining detailed payment fields remain open.

## Approved account billing design

Confirmed on 2026-10-15 by “this is fine. move on”. Adopt the reviewed account-wide billing layout: current plan/usage, Pro offer or renewal action, M-Pesa phone checkout concept, and pending/failed/expired states. Preserve account-wide allowance messaging and record preservation on expiry. Personal-number integration eligibility remains unresolved; approval is visual and does not establish a working payment route. Demo selectors and sample usage/dates are not production UI requirements. Exact allowance transitions, reset rules, and integration/error handling remain open. Implementation-only caveats shown around the preview must not become production product copy.

## Approved invoice management and navigation

Confirmed on 2026-10-15 by “okay. approved” after reviewing invoice management and clarifying navigation.

Adopt the reviewed searchable invoice list with status/Overdue filtering, invoice details and compact payment summary, and contextual Record payment, View invoice, Share, and Edit actions. The payment form contains amount, payment date, method, and optional reference. Existing invoice editing/payment rules still apply. Sample values, placeholder actions, and mock payment persistence remain demonstrations.

Use the same left desktop navigation throughout the signed-in business application: Overview, Invoices, Clients, Settings, with the business selector above. Account settings and billing are accessed through the account menu within that shell. Focused previews that omitted the sidebar do not replace this navigation. On smaller screens, collapse the sidebar into a menu; its detailed interaction still needs design. Public client invoices and authentication/onboarding screens retain their separate contexts.

## Approved mobile navigation direction

Confirmed on 2026-10-15 by “yes it does”. Adopt the reviewed mobile navigation: top-left menu opens business selection and Overview/Invoices/Clients/Settings; account settings and billing remain accessible from the account area. Use compact invoice cards, vertically arranged financial summaries, and single-column forms with the existing visual style. Navigation overlay must support close/back behavior and accessible focus handling in production. Placeholder mobile forms and sample interactions do not replace approved full-screen requirements.

## Versioned design previews

All nine reviewed concepts are packaged in [docs/designs](designs/README.md), including standalone browser previews and editable source fragments. Use that index to open the screens. The dashboard defaults reflect the approved 6px panel corners. These previews illustrate the design; later confirmed product rules remain authoritative.

## Design gaps found in review

Reviewed on 2026-10-15 against the PRD, database model, and decision log. These are needed before or during the related implementation phase; none has been designed or approved yet.

Screens and states missing for confirmed requirements:

- Add another business from the business selector (Phase 1).
- Sign in, forgot password, reset password, and account settings (Phase 1). The mobile menu already links to account settings.
- Create a client from inside the invoice editor, and remove a line item (Phase 2).
- Allowance reached: what Mark as Ready shows at 10/10 on Free or 100/100 on Pro (Phase 2).
- Cancel invoice and delete draft actions with confirmation (Phase 2/3).
- Payment history on the invoice detail, with correct and reverse actions that require a reason (D043, Phase 3).
- Share sheet: copy link, WhatsApp, email draft, PDF download, and disable or replace the link (Phase 3).
- Unavailable public invoice page and first-use empty states (Phase 3).
- Billing states adopted in D044: cancel Pro, undo cancellation, cancelled with an access-until date, Free-to-Pro carry-over (for example 93 of 100 left), and early renewal that holds the next allowance until its period starts (Phase 4).
- Bank transfer fields for payment instructions, once the exact fields are decided.

Open design questions raised by the previews:

- The client-facing invoice footer shows "Created with Billsafi", but footer branding policy is unresolved.
- The client-facing invoice ends with a fixed "Thank you for choosing Mawira Studio." line. Decide whether this is fixed text, a business setting, or removed.
- The previews follow the system colour scheme and render dark on dark-mode devices. Only a light theme is described, and some dark-mode badges and labels have low contrast. Decide whether dark mode is in V1.

Preview corrections made on 2026-10-15: the billing expired state now describes the adopted downgrade rule, client-facing invoice sample amounts and dates match the other screens, and onboarding no longer leaves the profile phone in the Till or Paybill field.

Notes for implementation: build calculations to the decimal rounding rules rather than the preview's floating-point code; replace the `＋`, `×`, and `←` text glyphs with `lucide-react` icons; drop the preview host hooks (`window.openai.setWidgetState`, the Tweak panel corner slider).
