#!/usr/bin/env sh
# Nightly Postgres dump kept for 14 days. Run from cron on the droplet:
#   15 2 * * * /opt/tallynest/backup.sh >> /var/log/tallynest-backup.log 2>&1
# These files live on the droplet's own disk; copy them off the droplet too (see deploy/README.md).
set -eu

cd "$(dirname "$0")"
mkdir -p backups
file="backups/tallynest-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose exec -T postgres pg_dump -U tallynest -d tallynest --format=custom > "${file}.partial"
mv "${file}.partial" "${file}"
find backups -name 'tallynest-*.dump' -mtime +14 -delete

echo "Backup written to ${file}"
