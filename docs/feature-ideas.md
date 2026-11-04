# Feature ideas

Last updated: 2026-11-03

Status: **Proposed / unresolved.** Nothing here is confirmed scope. Each idea needs a product decision before it moves into the [PRD](prd.md).

These ideas come from comparing BillSafi with FreshBooks, Zoho Invoice, Wave, Invoice Ninja, Kopo Kopo and Pesapal. They are ranked by expected value for Kenyan freelancers and by how well they fit what already exists.

## Already in BillSafi

Invoices with discount and optional tax, saved clients, manual payment recording with corrections, PDF download, public invoice links, WhatsApp and email share drafts, multiple businesses per account, the overview dashboard, and Free and Pro plans with M-Pesa subscription checkout.

## Tier 1: highest value

### 1. Payment reminders

Send reminders before the due date, on the due date, and after it (for example "3 days overdue") by WhatsApp, SMS or email. Every competitor offers this, and chasing payment is the most common freelancer complaint.

- Builds on the existing overdue indicator (D049).
- Needs a scheduled job and an SMS or mail provider behind an interface with a local fake.
- Open: which channels, default schedule, whether users can turn it off per client or invoice, Free vs Pro.
- A strong reason to upgrade to Pro.

### 2. M-Pesa collection on invoices

Add a "Pay now" option to the public invoice page, using STK Push or Paybill with the invoice number as the account number. Payments are matched to the invoice and recorded automatically.

- Already deferred to V2 in the PRD.
- The STK Push and callback handling built for subscriptions can be reused.
- Open: provider choice, how money reaches each freelancer (their own Till or Paybill vs platform settlement), fees, matching rules for partial or wrong amounts.
- The biggest advantage over foreign tools that do not support M-Pesa.

### 3. Quotes and estimates

Moved into the PRD ([D070](decisions.md)).

Let freelancers send a quote before the work starts. The client accepts it on a public link, and the freelancer turns it into an invoice in one step.

- Reuses invoice line items, totals and public links.
- Open: separate numbering (for example `QT-00001`), expiry, whether accepting needs the client's name, and whether quotes count toward the allowance (suggested: no).

### 4. Recurring invoices

Generate invoices for retainers and monthly fees on a schedule, either as drafts or straight to Ready.

- Each generated Ready invoice uses allowance like any other.
- Open: frequencies, behaviour when the allowance runs out, whether to notify the client automatically.

### 5. KRA eTIMS support

VAT-registered businesses must issue invoices through eTIMS. Foreign tools ignore this.

- A first step could store the eTIMS control number and QR code and print them on the PDF.
- Full integration means submitting invoices to KRA, which needs research into the API and onboarding.
- The PRD currently says invoice preferences do not establish tax compliance, so this needs an explicit decision.

## Tier 2: makes Pro worth paying for

### 6. Receipts

Create a receipt PDF and link when a payment is recorded. Kenyan clients often ask for one.

### 7. Client statements

One page per client listing all invoices, payments and the current balance. Useful for clients with many open invoices.

### 8. Reports and export

Income by month and by client, an aging report (0 to 30, 31 to 60 and over 60 days overdue), and CSV or Excel export for accountants and KRA filing.

### 9. Saved items and services

Store common line items with a default price so they can be picked when building an invoice.

### 10. More currencies

USD and EUR for freelancers billing foreign clients. The `currency` column already exists on invoices and businesses. Dashboard totals would need to be grouped by currency.

### 11. Templates and brand colours

More PDF layouts and a choice of accent colour, within the confirmed PDF colour rules.

### 12. Viewed tracking

Show "Client viewed this invoice on ..." based on public link opens. Cheap to build and useful when following up.

## Tier 3: later

- **Expense tracking** with receipt photos and a simple profit view.
- **Time tracking** that turns logged hours into invoice lines.
- **Client portal** where a client sees all their invoices and payments from one link.
- **Team access** for an accountant or assistant. Already deferred in the PRD.
- **Late fees** added after the due date.
- **Deposits** requested up front on large jobs.
- **Card and bank payments** through Pesapal or Flutterwave for diaspora and foreign clients.
- **Public API and webhooks** under the existing `/api/v1` prefix.

## Plan fit and appeal

The PRD says both plans include the essential invoicing workflow. So the rule used here is: anything a freelancer needs to create, send and get paid for an invoice stays on Free. Pro gets automation, insight, branding, and features that only some users need but those users will pay for. Today the only difference between the plans is the invoice allowance (10 vs 100), so Pro needs more reasons to buy.

Appeal is how much the feature is likely to make a user sign up or upgrade:

- **High:** users will choose BillSafi or upgrade for this alone.
- **Medium:** valued, tips a decision, rarely the main reason.
- **Low:** nice to have, expected, or used by few.

### Pro features

| Feature | Appeal | Why it belongs in Pro |
| --- | --- | --- |
| Automatic payment reminders | High | Saves the most time and brings money in faster. Free keeps the manual WhatsApp/email share, so the core flow is not blocked. |
| Recurring invoices | High for retainer clients, medium overall | Pure automation. Users with monthly clients will pay to stop rebuilding the same invoice. |
| KRA eTIMS support | High for VAT-registered users, low for others | A must-have for the users who need it, and they are usually higher-earning. Most freelancers are under the VAT threshold and will not miss it. |
| Viewed tracking | Medium to high | Cheap to build and easy to understand. "Your client opened the invoice yesterday" is a strong prompt to follow up, and a good teaser on Free. |
| Reports beyond the dashboard, aging, and CSV/Excel export | Medium to high | Becomes urgent at tax time and when working with an accountant. |
| More currencies | High for foreign-client freelancers, low for others | Users billing in USD or EUR tend to earn more and can afford KES 500. |
| Client statements | Medium | Matters once a user has repeat clients with several open invoices. |
| Templates and brand colours | Medium | Clients see it, so it makes the freelancer look more professional. |
| Expense tracking (later) | Medium | Turns BillSafi into a simple profit tracker. |
| Time tracking (later) | Medium for hourly workers, low overall | |
| Client portal (later) | Medium | |
| Late fees (later) | Low to medium | Many Kenyan freelancers avoid charging them to keep the relationship. |
| Team access (later) | Medium for small agencies | May fit a higher tier instead of Pro. |
| Public API and webhooks (later) | Low | Few freelancers will use it. Better suited to a higher tier. |

### Free features

| Feature | Appeal | Why it stays on Free |
| --- | --- | --- |
| M-Pesa collection on invoices | Very high | The strongest reason to choose BillSafi at all. Locking it behind Pro would slow adoption. Charge a per-transaction fee on all plans (optionally lower on Pro) instead. |
| Quotes and estimates | Medium to high | Part of the normal "quote, then invoice" workflow. Quotes do not count toward the invoice allowance, but a quote converted to an invoice does once it becomes Ready, so Free users still feel the cap. |
| Receipts | Medium | Clients expect one after paying. Withholding it would look petty and would be easy to get around. |
| Saved items and services | Low to medium | A small convenience that makes invoices faster to create and keeps users coming back. |
| Deposits (later) | Medium | Part of getting paid. |
| Card and bank payments (later) | Medium | Same model as M-Pesa collection: free to turn on, paid through a transaction fee. |

### Split between plans

Some features work best as a basic version on Free and a full version on Pro:

- **Reminders:** Free gets the prepared WhatsApp/email message to send by hand. Pro sends reminders automatically on a schedule.
- **Reports:** Free keeps the dashboard totals. Pro adds income by month and client, aging, and export.
- **Viewed tracking:** Free shows "Viewed" with no detail. Pro shows when and how often.
- **Templates:** Free gets the standard layout. Pro gets the other layouts and accent colours.

The upgrade pitch for a typical user becomes "stop chasing clients, see who opened your invoice, and get tax-ready reports", not "send more than 10 invoices".

## Suggested order

1. Payment reminders
2. Receipts

Both reuse existing models, neither needs a payment provider, and reminders give a clear reason to upgrade. Start M-Pesa invoice collection once Daraja credentials and the settlement model are settled, since it is the main long-term advantage.
