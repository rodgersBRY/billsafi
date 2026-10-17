# TallyNest launch checklist

Work through this list before inviting real users. Each item says how to check it. The deployment steps themselves are in [deploy/README.md](../deploy/README.md).

## Accounts and services

- [ ] **Domain and HTTPS.** The domain points at the droplet and Caddy serves a valid certificate. Open the site and check the padlock.
- [ ] **Email through Resend (D052).** Add the domain in Resend, publish the SPF and DKIM records it lists, and wait for it to show as verified. Set `SMTP_URL=smtps://resend:<API key>@smtp.resend.com:465` and `MAIL_FROM=TallyNest <no-reply@your-domain>`. Trigger a password reset to your own address and confirm it arrives in the inbox, not spam.
- [ ] **Sentry (D052).** Create one Sentry project for the API (Node) and one for the web app (Next.js). Put the DSNs in `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`. After deploying, the API log shows `Sentry error reporting is on`. Set up an alert rule that emails you on new issues, and confirm the first event arrives by following the "Verify" step on each project's setup page.
- [ ] **Uptime check.** Add a monitor in UptimeRobot (or any similar service) for `https://<domain>/api/v1/health`, checking every five minutes, with alerts to your email and phone. It should expect the text `"database":"ok"`.
- [ ] **M-Pesa Paybill (D051).** Until Safaricom approves the Paybill, leave `MPESA_ENV=disabled`. After approval, switch to `production`, fill in the Daraja keys, then buy one month of Pro from your own account and confirm the receipt appears under Billing.

## Data safety

- [ ] **Nightly backups run.** `ls /opt/tallynest/backups` shows a dump from last night.
- [ ] **A restore works.** Restore last night's dump into a scratch database and open a few invoices. Do this once before launch and again every few months.
- [ ] **Droplet backups are on** in the DigitalOcean control panel.
- [ ] **Secrets are stored** in a password manager: `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `MPESA_CALLBACK_TOKEN`, the Resend key, and the Daraja keys.

## Product walk-through

Do this on a phone and on a laptop, once with the device in light mode and once in dark mode.

- [ ] Sign up, set up a business, skip payment instructions, and land on the overview.
- [ ] Add a client, create an invoice with a discount and tax, and mark it Ready. The number reads `INV-00001`.
- [ ] Upload a logo in Settings. It shows on new invoices, the public page, and the PDF.
- [ ] Share the invoice link and open it in a private window. Download the PDF and check it is A4, white, and readable.
- [ ] Record a partial payment, correct it, and reverse it. The balance and status follow each change.
- [ ] Reach the Free limit of 10 invoices. The 11th is refused with a link to Billing.
- [ ] Reset the password from the sign-in page using the emailed link.
- [ ] Change the password in Settings and confirm another signed-in browser is signed out.
- [ ] Open a page that does not exist and a business that belongs to someone else. Both show the "We couldn't find that page" screen.

## Accessibility

- [ ] Every page can be used with the keyboard alone, with a visible focus ring.
- [ ] Text and controls pass contrast in both light and dark mode (check with the browser's accessibility tools).
- [ ] Forms announce errors next to the field they belong to.

## Before announcing

- [ ] The product name and domain are available and registered.
- [ ] Final brand assets are in place (favicon, app icon, logo animation).
- [ ] CI is green on `main`, and the deployed commit matches the latest **Publish images** run.
