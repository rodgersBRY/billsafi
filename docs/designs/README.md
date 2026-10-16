# TallyNest design previews

Packaged: 2026-10-15. All nine reviewed design concepts are stored here.

Open an HTML preview in a modern browser to explore it. These are interactive mockups with sample data, not production application screens. No real accounts, payments, or PDF downloads are created.

| Design                | Browser preview                               | Editable source                                 |
| --------------------- | --------------------------------------------- | ----------------------------------------------- |
| Dashboard             | [Open preview](tallynest-dashboard.html)      | [Source](sources/tallynest-dashboard.html)      |
| Invoice editor        | [Open preview](tallynest-invoice-editor.html) | [Source](sources/tallynest-invoice-editor.html) |
| Client-facing invoice | [Open preview](tallynest-client-invoice.html) | [Source](sources/tallynest-client-invoice.html) |
| Onboarding            | [Open preview](tallynest-onboarding.html)     | [Source](sources/tallynest-onboarding.html)     |
| Client management     | [Open preview](tallynest-clients.html)        | [Source](sources/tallynest-clients.html)        |
| Business settings     | [Open preview](tallynest-settings.html)       | [Source](sources/tallynest-settings.html)       |
| Account billing       | [Open preview](tallynest-billing.html)        | [Source](sources/tallynest-billing.html)        |
| Invoice management    | [Open preview](tallynest-invoices.html)       | [Source](sources/tallynest-invoices.html)       |
| Mobile navigation     | [Open preview](tallynest-mobile.html)         | [Source](sources/tallynest-mobile.html)         |

## Source and approval notes

`sources/` contains the editable conversation fragments; the files beside this index are standalone browser exports with their display runtime bundled. The dashboard source/export defaults were aligned to the approved 6px panel corners; other source files were copied unchanged. Current approvals are described in [Brand and product design](../brand-and-design.md). Later decisions in the [decision log](../decisions.md) take precedence over any outdated sample text.

Desktop previews are focused screen concepts; the production signed-in app must retain the approved shared left navigation. Public invoice and onboarding contexts are separate. The client invoice preview uses application colours; downloaded PDFs must follow the adopted white-background/dark-text rule. Personal-number subscription integration remains unresolved despite the illustrative M-Pesa checkout.

The optional host design controls are unavailable outside the conversation; local preview interactions still work. Icons may require an internet connection if the bundled preview runtime loads them from a CDN.

To regenerate a browser preview, use the visualization skill’s standalone renderer on its corresponding source fragment. Keep both the source and export updated when revising a design.
