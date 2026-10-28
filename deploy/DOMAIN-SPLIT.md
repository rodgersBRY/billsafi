# Serve marketing and accounts on separate domains

The same Next.js image serves both hosts. Caddy terminates HTTPS. Next.js routes
`billsafi.com` to the landing page and legal pages, and `account.billsafi.com` to
sign-in, the application, public invoices, and the free invoice generator.
The generator stays on the account origin because its draft and anonymous ID are
stored in browser local storage and its embedded authentication uses same-origin
cookies. Existing generator drafts on a previous hostname cannot move automatically;
visitors should finish those drafts before the switch. Existing users must sign in
again on the new account hostname. No shared parent-domain cookie is needed.

## 1. Publish the release

Merge the feature branch into `develop`, then release `develop` through `main`
using the normal CI workflow. Wait for **Publish images** to finish successfully.
Do not switch server configuration before the new web image is available.
This release also includes the custom invoice numbers migration merged into develop.
Take a current database backup before deploying.

## 2. Configure DNS

At the DNS provider, create A records for `@` and `account`, both pointing to the
droplet's public IPv4 address. Remove or correct conflicting AAAA records if the
server is not reachable on IPv6. Keep ports 80/TCP, 443/TCP and optionally 443/UDP
open to Caddy. Verify from your laptop:

```sh
dig +short billsafi.com
dig +short account.billsafi.com
```

Both must resolve to the droplet. This configuration does not add `www`; add DNS
and a Caddy redirect separately if you need that hostname.

## 3. Copy the deployment files

From the repository root on your laptop, replacing `<droplet-ip>`:

```sh
scp deploy/compose.yml deploy/Caddyfile deploy/deploy.sh deploy/backup.sh deploy@<droplet-ip>:/opt/billsafi/
ssh deploy@<droplet-ip>
```

## 4. Back up and update the server environment

On the droplet:

```sh
cd /opt/billsafi
cp .env .env.before-domain-split
chmod 600 .env.before-domain-split
nano .env
```

Set these values, keeping the existing secrets and image settings:

```dotenv
DOMAIN=account.billsafi.com
LANDING_DOMAIN=billsafi.com
```

Compose derives the web server's runtime `APP_ORIGIN` and `MARKETING_ORIGIN` and
the API's `WEB_ORIGIN` from these variables. Do not add `NEXT_PUBLIC_*` domain
settings or change auth secrets. Domain changes do not require rebuilding images.

```sh
chmod 600 .env
chmod +x deploy.sh backup.sh
docker compose config --quiet
./backup.sh
```

## 5. Update external callback settings

If Google sign-in is enabled, register this authorized redirect URI on the existing
Google OAuth web client before deployment:

```text
https://account.billsafi.com/api/v1/auth/callback/google
```

If Google has configured JavaScript origins, add `https://account.billsafi.com` there.
If M-Pesa is enabled, update any separately registered callback URL to
`https://account.billsafi.com/api/v1/billing/mpesa/callback/<existing-token>`.
Compose already derives the callback base URL from `DOMAIN`; preserve the token.
Update uptime monitoring to `https://account.billsafi.com/api/v1/health`.
Keep any previous callback URI temporarily while transitioning existing traffic.

## 6. Deploy and reload Caddy

```sh
./deploy.sh
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

The explicit reload ensures Caddy reads the changed bind-mounted file even when
Compose does not recreate the container. Caddy obtains certificates automatically.
If deployment fails, inspect:

```sh
docker compose ps
docker compose logs --tail=100 caddy web api
```

## 7. Verify

```sh
curl -I https://billsafi.com/
curl -I https://billsafi.com/sign-in
curl -I https://billsafi.com/free-invoice-generator
curl -I https://account.billsafi.com/
curl -fsS https://account.billsafi.com/api/v1/health
```

Expected: the landing returns 200; marketing sign-in and generator paths redirect
to the same paths on the account host; an anonymous account root redirects to
`/sign-in`; health returns `{"status":"ok","database":"ok"}`.

In a browser, check landing buttons, sign-up, sign-in, Google sign-in if enabled,
password reset email links, a public invoice and its PDF, and the complete free
generator flow through account creation and invoice download. Confirm the landing
still appears at the root domain when signed in on the account domain.

## Rollback

Use the previous image SHA printed by `deploy.sh` to roll back application images.
If also reverting the domain split, restore the previous `.env`, `compose.yml`, and
`Caddyfile` from the previous release, deploy that SHA, and reload Caddy. Restore
external callback settings to match. An image rollback does not undo database
migrations; do not restore a database backup over new production data casually.
