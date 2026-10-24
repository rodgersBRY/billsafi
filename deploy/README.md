# Deploying BillSafi to a DigitalOcean droplet

This guide explains how production works and lists every step to get it running, starting from an empty DigitalOcean account. Do the one-time setup in order. After that, each release is a merge to `main` followed by one command on the droplet.

## How it works

Production runs on one droplet with Docker Compose. Five containers share a private Docker network:

| Container  | Role                                                                          |
| ---------- | ----------------------------------------------------------------------------- |
| `caddy`    | Public entry point on ports 80 and 443. Gets and renews the HTTPS certificate |
| `web`      | Next.js app. Forwards `/api/*` to the API over the internal network           |
| `api`      | NestJS API. Not reachable from the internet                                   |
| `postgres` | PostgreSQL 18, data kept in a Docker volume                                   |
| `migrate`  | One-off job that applies Drizzle migrations during each deploy                |

The release flow:

1. You merge a pull request into `main`.
2. The CI workflow runs and passes.
3. The **Publish images** workflow builds three images (`api`, `migrate`, `web`) and pushes them to GitHub Container Registry (GHCR). Each image gets two tags: the commit SHA and `latest`.
4. You SSH into the droplet and run `./deploy.sh`. It pulls the `latest` images, runs migrations, restarts the containers and checks `https://<your domain>/api/v1/health`.

GitHub never connects to the droplet. Images are built on GitHub's runners, so the droplet doesn't compile anything either.

## What was added to the repository

| File                            | Purpose                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `apps/api/Dockerfile`           | Builds the `api` image and the `migrate` image (two targets in one file)    |
| `apps/web/Dockerfile`           | Builds the `web` image from Next.js standalone output                       |
| `.dockerignore`                 | Keeps `node_modules`, build output, `.env` and docs out of image builds     |
| `apps/web/next.config.ts`       | Turns on standalone output only when `NEXT_STANDALONE=1` (set in the image) |
| `.github/workflows/publish.yml` | Builds and pushes the images to GHCR after CI passes on `main`              |
| `deploy/compose.yml`            | The production stack                                                        |
| `deploy/Caddyfile`              | HTTPS and reverse proxy to `web`                                            |
| `deploy/.env.example`           | Template for the secrets file on the droplet                                |
| `deploy/deploy.sh`              | Pull, migrate, restart, health check. Also used for rollbacks               |
| `deploy/backup.sh`              | Nightly `pg_dump` with 14 days of retention                                 |

Local development and CI behave exactly as before.

## Before you start

You need:

- A DigitalOcean account.
- A domain you control, for example `app.billsafi.co.ke`.
- A production email provider that gives you SMTP credentials (Postmark, Resend, Brevo, Amazon SES and others all work). Password reset emails won't send without it.
- Your GitHub account, to create a token that lets the droplet pull images.

## Step 1: Create the droplet

In the DigitalOcean control panel, create a droplet with:

- **Image:** Ubuntu 24.04 LTS.
- **Size:** Basic, 2 GB RAM / 1 vCPU at minimum. Postgres, the API and Next.js together use about 1 GB, and the rest is headroom for deploys.
- **Region:** Frankfurt (FRA1) or London (LON1). DigitalOcean has no African region, and these two have the lowest latency to Nairobi.
- **Authentication:** SSH key. Add your laptop's public key.
- **Backups:** turn on weekly droplet backups. They are your off-machine copy if the droplet itself is lost.

Note the droplet's public IPv4 address.

## Step 2: Point your domain at the droplet

At your DNS provider, create an `A` record for your domain with the droplet's IP as the value. Caddy can only get a certificate once this record resolves, so do it early. Check it from your laptop:

```sh
dig +short app.billsafi.co.ke
```

## Step 3: Prepare the server

SSH in as root:

```sh
ssh root@<droplet-ip>
```

Install Docker:

```sh
curl -fsSL https://get.docker.com | sh
```

Create a `deploy` user for running the app, give it Docker access and the app folder, and let it log in with the same SSH key you used for root:

```sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /opt/billsafi
chown deploy:deploy /opt/billsafi
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

Open only SSH and web traffic in the firewall:

```sh
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
```

From now on, log in as `deploy` for everything except system updates:

```sh
ssh deploy@<droplet-ip>
```

## Step 4: Give the droplet read access to GHCR

The images are private, so the droplet has to log in to GHCR before it can pull them.

On GitHub, open **Settings > Developer settings > Personal access tokens > Tokens (classic)** and generate a new token with only the `read:packages` scope. Set an expiry date and put a reminder in your calendar to replace it. GHCR doesn't accept fine-grained tokens, which is why this has to be a classic one.

On the droplet, as `deploy`, log in with that token:

```sh
echo "<token>" | docker login ghcr.io -u <your-github-username> --password-stdin
```

Docker saves the login in `/home/deploy/.docker/config.json`, so you only do this once per token. The file holds the token in plain text, so don't give anyone else access to the `deploy` account. Because the token can only read packages, a leak can't change your code or your images.

## Step 5: Copy the stack files to the droplet

From your laptop, in the repository root:

```sh
scp deploy/compose.yml deploy/Caddyfile deploy/deploy.sh deploy/backup.sh deploy@<droplet-ip>:/opt/billsafi/
ssh deploy@<droplet-ip> chmod +x /opt/billsafi/deploy.sh /opt/billsafi/backup.sh
```

Run the same `scp` again whenever one of these four files changes in the repository. They rarely do.

## Step 6: Write the production secrets file

On the droplet, as `deploy`:

```sh
cd /opt/billsafi
nano .env
```

Paste the template from `deploy/.env.example` and fill it in:

- `DOMAIN`: your domain, without `https://`.
- `IMAGE_PREFIX`: `ghcr.io/<your GitHub username in lowercase>/billsafi`. For `rodgersBRY/billsafi` that is `ghcr.io/rodgersbry/billsafi`. It changes only if the repository moves to another owner.
- `IMAGE_TAG`: leave it as `latest`. `deploy.sh` manages this line.
- `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`: run `openssl rand -hex 32` once for each. Use hex values because the password goes into a connection URL, where characters like `/` or `@` would break it.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the Google OAuth web client for "Continue with Google" (D055). Leave both blank to hide the button. In Google Cloud Console, create an OAuth client of type **Web application** and add `https://<DOMAIN>/api/v1/auth/callback/google` as an authorized redirect URI.
- `ADMIN_EMAILS`: the email addresses allowed to open the read-only admin dashboard at `/admin` (D057), separated by commas. Leave it blank to turn the dashboard off for everyone.
- `SMTP_URL` and `MAIL_FROM`: the email provider is Resend (D052). Verify your domain in Resend first, then use `smtps://resend:<API key>@smtp.resend.com:465` and a `MAIL_FROM` address on that domain.
- `SENTRY_API_DSN` and `SENTRY_WEB_DSN`: the DSNs of your two Sentry projects. Leave them blank to turn error reporting off. Browser errors need the web DSN at build time too: add it as a repository variable named `SENTRY_WEB_DSN` under **Settings > Secrets and variables > Actions > Variables**, then publish new images.
- `MPESA_ENV`: keep it `disabled` until Safaricom approves the Paybill for Daraja. Checkout then shows a "not available yet" message and nothing else changes. Once approved, set it to `production` and fill in `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE` (the Paybill number), `MPESA_PASSKEY`, and an `MPESA_CALLBACK_TOKEN` from `openssl rand -hex 24`. Safaricom calls back to `https://<DOMAIN>/api/v1/billing/mpesa/callback/<token>`, so the token stays private.

Lock the file down:

```sh
chmod 600 .env
```

Keep a copy of these values in a password manager. Losing `BETTER_AUTH_SECRET` signs every user out. Losing `POSTGRES_PASSWORD` means resetting it from inside the database container.

## Step 7: Publish the first images

`main` currently sits far behind `develop`. Open a pull request from `develop` into `main`, let CI pass, and merge it.

In the **Actions** tab, wait for CI to finish on `main`. The **Publish images** workflow then starts on its own. The first run takes several minutes; later runs reuse cached layers and finish faster. When it's done, the run summary shows the commit SHA it published.

The three packages appear under **Packages** on your GitHub profile as `billsafi-api`, `billsafi-migrate` and `billsafi-web`.

## Step 8: Deploy

On the droplet, as `deploy`:

```sh
cd /opt/billsafi
./deploy.sh
```

The script:

1. Pulls the `latest` images for `api`, `web` and `migrate`.
2. Starts Postgres if it isn't running and waits until it's healthy.
3. Runs the migrations.
4. Starts or replaces the `api`, `web` and `caddy` containers and waits for their health checks.
5. Requests `https://<your domain>/api/v1/health` until it succeeds, then prints the deployed commit and the command to roll back.

If the pull fails, nothing changes and `.env` is left as it was. The usual cause is an expired GHCR token (see Step 4).

The first deploy takes a little longer because Caddy has to request the certificate.

## Step 9: Check it works

- Open your domain in a browser. You should land on the BillSafi landing page over HTTPS, with **Sign in** and **Create account** in the header.
- Visit `https://<your domain>/api/v1/health`. It should return `{"status":"ok","database":"ok"}`.
- Create an account, then trigger a password reset to confirm email delivery.

## Step 10: Turn on nightly backups

On the droplet, as `deploy`, open the crontab:

```sh
crontab -e
```

Add this line:

```
15 2 * * * /opt/billsafi/backup.sh >> /home/deploy/backup.log 2>&1
```

This writes a dump to `/opt/billsafi/backups` at 02:15 UTC every night and deletes dumps older than 14 days. Run it once by hand to check it works:

```sh
/opt/billsafi/backup.sh
```

These dumps sit on the same disk as the database, so they won't help if the droplet is destroyed. The weekly droplet backups from Step 1 cover that case. For a tighter recovery window, copy the dumps to DigitalOcean Spaces with `rclone` or `s3cmd` after each run.

## Day-to-day operations

**Releasing.** Merge into `main`, wait for **Publish images** to go green, then run `./deploy.sh` on the droplet.

**Rolling back.** Every successful deploy prints a line such as `Roll back with: ./deploy.sh 3b1d1e1...`. Run that command to go back to the previous release. You can deploy any commit that was published, because every image is also tagged with its SHA. Find the SHAs in the **Publish images** run summaries or on the package pages. To return to the newest release afterwards, run `./deploy.sh` with no argument.

To publish images for a commit that never went through the workflow, open **Actions > Publish images > Run workflow** and enter its SHA. That publishes only the SHA tag and leaves `latest` alone.

**Migrations.** Each deploy runs migrations before the new code starts, and a rollback does not undo them. Write migrations so the previous release still works against the new schema: add columns and tables first, and drop old ones only in a later release once nothing reads them.

**Logs.**

```sh
cd /opt/billsafi
docker compose logs -f api
docker compose logs -f web
```

**Status.**

```sh
docker compose ps
```

**Restoring a backup.** This replaces the current database contents, so take a fresh backup first.

```sh
cd /opt/billsafi
./backup.sh
docker compose stop api web
docker compose exec -T postgres pg_restore -U billsafi -d billsafi --clean --if-exists < backups/<file>.dump
docker compose start api web
```

**Changing a secret.** Edit `/opt/billsafi/.env`, then run `docker compose up -d` in the same folder. Compose recreates only the containers whose settings changed.

**Replacing the GHCR token.** Generate a new classic token with `read:packages` and run the `docker login` command from Step 4 again.

**Server updates.** As root, run `apt update && apt upgrade` every month or so, and reboot when the kernel updates. The containers start again on their own.
