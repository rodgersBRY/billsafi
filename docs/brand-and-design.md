# TallyNest — brand and product design

Last updated: 2026-10-15
Status: confirmed brand foundation; visual design in progress.

## Confirmed

Product name: **TallyNest**.
Primary brand colour: **Deep teal — `#0F766E`**.

Source: the user's “I like tallynest and the deep teal” in the continuation chat. Name, domain, and trademark availability have not been checked.

## Proposed supporting direction — awaiting confirmation

Warm off-white background, white cards/forms, dark slate text, restrained use of teal, readable financial amounts, and labelled status indicators. Exact supporting colours, typography, logo, spacing, and responsive screen layouts remain unconfirmed.

Wave invoicing and Zoho Invoice dashboard were suggested as reference designs, not approved requirements:

- https://www.waveapps.com/invoicing
- https://www.zoho.com/us/invoice/help/dashboard/

Proposed design sequence: dashboard/navigation, invoice creation, client-facing invoice, then onboarding, client management, settings, and billing. No mockup or implementation has yet been approved.

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

Confirmed on 2026-10-15 by the user's “thats fine”. Downloaded PDFs use a white background with black/dark-grey text, neutral headings, thin grey dividers, and bold totals. The freelancer's business name and optional logo lead the document. TallyNest teal remains in the application interface rather than being imposed on the PDF. Preserve the approved invoice layout and compact payment summary. This does not require recolouring uploaded business logos. Footer branding policy remains unresolved.
