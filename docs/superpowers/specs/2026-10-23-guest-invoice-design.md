# Free invoice generator before sign-up

Status: approved on 2026-10-23. Recorded as D056 once built.

## Goal

A visitor can build a real invoice on a public page without an account. When they press "Save & download", they create an account (Google or email) and the invoice is saved to that account as a draft. They check it in the app editor, press Mark as Ready, and download the PDF.

People get to see the product working before we ask for anything, and we ask at the moment they most want to keep what they made.

## User flow

1. Landing hero: main button "Create an invoice free" links to `/free-invoice-generator`. "Create account" becomes the second button. The sample dialog on the landing page is removed, and its buttons link to the new page instead.
2. `/free-invoice-generator` (public): the visitor fills in the form and watches the preview update.
3. "Save & download" checks the whole form. If anything is wrong, errors show next to the fields.
4. When the form is valid, a sign-up dialog opens over the page: "Continue with Google", then name, email, and password, plus a link to switch to sign-in.
5. After sign-up or sign-in, the browser goes to `/free-invoice-generator/finish`. Google sends the user back there for both new and returning accounts.
6. The finish page sends the stored draft to the import endpoint, clears it from the browser, and opens the draft at `/<businessId>/invoices/<invoiceId>/edit?from=generator`.
7. The editor shows a banner: "Your invoice is saved as a draft. Check it, then press Mark as Ready to get your PDF."

The onboarding wizard is skipped because the import creates the business. Payment methods can be added later in Settings.

## The public page

Same layout as the app editor: form on the left with a live preview on the right on desktop, stacked on phones.

Form sections and rules. Every rule comes from the existing schemas in `@billsafi/contracts`, so the browser and the API agree.

- Your business (`createBusinessSchema`): individual or business, display name, email, Kenyan phone. Address and KRA PIN are optional.
- Bill to (`createClientSchema`): client name and Kenyan phone. Email, company, address, and KRA PIN are optional.
- Items (`invoiceItemSchema`): description, quantity, and unit price. Rows can be added and removed, up to 100.
- Dates: issue date defaults to today and due date to today plus 14 days. The due date can't be before the issue date.
- Optional discount (fixed or percentage) and tax rate, payment instructions, and notes.

Preview: the existing `InvoicePreview` component with no invoice number, Draft status, and no logo. Totals come from `calculateInvoice` in `@billsafi/domain`.

Copy under the page heading: "Saved in this browser. A free account is needed to save and download. It takes 10 seconds."

The page has its own metadata (title and description aimed at people searching for "free invoice generator Kenya") and is added to the proxy's public paths.

## Browser storage

- Key `billsafi:guest-invoice:v1`. The JSON holds `{ version: 1, business, client, invoice }`, using the same field names as the import request.
- Written as the visitor types, with a short debounce. Read on page load, and anything invalid is ignored.
- All reads and writes are wrapped in try/catch. If storage is blocked, the page still works and the draft only lasts until the tab closes.
- Cleared after a successful import.

## Import endpoint

`POST /api/v1/guest-invoices/import` needs a session.

Request body (`importGuestInvoiceSchema` in `@billsafi/contracts`):

```
{
  business: createBusinessSchema,
  client: createClientSchema,
  invoice: saveInvoiceSchema without clientId
}
```

Response: `{ businessId, invoiceId, usedExistingBusiness }`.

It runs in one database transaction:

1. Lock the user's row (`select ... for update`) so two imports at the same moment can't both create a business.
2. If the account has no business, create one from `business`. If it has any, use the oldest one and ignore `business`; `usedExistingBusiness` is then true.
3. Reuse a client in that business with the same phone number, ignoring archived clients. Otherwise create the client.
4. Create the invoice as a draft.

If any step fails, nothing is saved. A draft does not use the monthly allowance (only Mark as Ready does), so this opens no way around the Free limit.

Service changes: `BusinessesService.create`, `ClientsService.create`, and `InvoicesService.createDraft` accept an optional transaction so the import can call them inside its own. Their current callers don't change.

## Finish page

`/free-invoice-generator/finish` needs a session. The proxy already sends signed-out visitors to sign-in.

- No stored draft (a refresh after success, or a different browser): go to `/`.
- Stored draft: call the import once, guarded against React running the effect twice, then clear storage and go to the editor.
- If the import fails with a validation error (an old or edited draft), go back to `/free-invoice-generator`. The form there shows the errors, so nothing typed is lost.
- If it fails for any other reason, show a "Try again" button. The draft stays in storage.

## Editor banner

The edit page reads `?from=generator` and shows the draft banner. When the import used an existing business, the finish page adds `&existing=1`, and the banner also says: "Added to <business name>. The business details you typed weren't used."

## Shared components

`invoice-editor.tsx` is 22 KB and tied to API saving. The line items section and the discount and tax section move into shared components that both editors use. The app editor's behaviour does not change.

## Auth changes

- `GoogleSignInButton` takes `callbackURL` and `newUserCallbackURL` as props, defaulting to today's values. The guest dialog passes `/free-invoice-generator/finish` for both.
- The sign-in and sign-up forms used in the dialog take an `onSuccess` callback. The guest dialog uses it to go to the finish page. The full-page forms keep their current redirects.

## Out of scope

- Logo upload for guests.
- Saving the guest's payment instructions as a business payment method. They stay on the invoice only.
- Drafts that follow the user across devices.
- Analytics events. These are planned separately and will cover this flow.

## Testing

- Contracts: `importGuestInvoiceSchema` accepts a full draft and rejects a missing client phone, a bad business email, and a due date before the issue date.
- API end-to-end:
  - A new account gets a business, client, and draft, and the allowance is unchanged.
  - An account that already has a business gets the draft added to that business, and `usedExistingBusiness` is true.
  - An existing client with the same phone is reused.
  - An invalid body returns 400 and saves nothing.
  - A request without a session returns 401.
- Browser:
  - A guest fills in the form, reloads, and the values are still there.
  - Signing up with email lands on the draft with the same values and the banner. Mark as Ready works and the PDF downloads.
  - The "Save & download" check shows field errors before the dialog opens.
  - The landing hero button opens the generator.
